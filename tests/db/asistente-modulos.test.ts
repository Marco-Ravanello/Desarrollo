import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { handleCasesSummary, handleLeavesQuery, handleMyTasksQuery } from "@/services/assistant/module-handlers";
import { queryAIAssistantStream } from "@/services/ai-assistant";
import { createArea, createUser } from "./helpers";
import { diaAR } from "@/lib/fechas";
import { buildAssistantScope } from "@/lib/assistant-scope";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

describe("respuestas del asistente para las partes nuevas", () => {
  it("cuenta los expedientes abiertos por área y no muestra Violencia de Género a quien no la ve", async () => {
    const ninez = await createArea("Dirección de Niñez");
    const vg = await createArea("Coordinación de Violencia de Género");
    const person = await prisma.person.create({ data: { dni: "93000001", firstName: "Uno", lastName: "Prueba" } });
    const mk = (areaId: string, priority: "URGENTE" | "MEDIA", status: "ABIERTO" | "CERRADO" = "ABIERTO") =>
      prisma.case.create({ data: { title: "Caso inventado", areaId, personId: person.id, priority, status } });
    await mk(ninez.id, "URGENTE");
    await mk(ninez.id, "MEDIA");
    await mk(ninez.id, "MEDIA", "CERRADO");
    await mk(vg.id, "MEDIA");

    const all = await handleCasesSummary(buildAssistantScope({ role: "SUPERADMIN" }));
    expect(all.answer).toContain("Hay **3 expedientes abiertos**: 1 urgente");
    expect(all.answer).toContain("| Coordinación de Violencia de Género | 1 |");
    expect(all.answer).not.toContain("Caso inventado");

    const director = await handleCasesSummary(buildAssistantScope({ role: "DIRECTOR_AREA", areaId: ninez.id }));
    expect(director.answer).toContain("Hay **2 expedientes abiertos**");
    expect(director.answer).toContain("Te muestro solo los datos de tu área.");
    expect(director.answer).not.toContain("Violencia");
    expect(director.dataSummary.actions.map((a: any) => a.payload.path)).toContain("/cases?priority=URGENTE");
  });

  it("dice quién está de licencia hoy y cuántas vueltas faltan confirmar", async () => {
    const today = new Date(`${diaAR(new Date())}T00:00:00Z`);
    const later = new Date(today.getTime() + 5 * 86400000);
    const before = new Date(today.getTime() - 3 * 86400000);
    const base = { contractType: "MENSUALIZADO" as const, lastName: "Inventada" };
    await prisma.hRRecord.create({ data: { ...base, dni: "93100001", firstName: "Sofía", status: "VACACIONES", statusUntil: later } });
    await prisma.hRRecord.create({ data: { ...base, dni: "93100002", firstName: "Tomás", status: "LICENCIA", statusUntil: before } });
    await prisma.hRRecord.create({ data: { ...base, dni: "93100003", firstName: "Lía" } });

    const res = await handleLeavesQuery();
    expect(res.answer).toContain("Hoy falta 1 persona.");
    expect(res.answer).toContain("| Inventada, Sofía |");
    expect(res.answer).not.toContain("Lía");
    expect(res.answer).toContain("1 persona terminó su licencia y falta confirmar que volvió.");
    expect(res.dataSummary.actions.map((a: any) => a.label)).toEqual(["Ver Ausencias del mes", "Confirmar las vueltas"]);
  });

  it("muestra solo las tareas pendientes de quien pregunta", async () => {
    const me = await createUser("DIRECTOR_AREA");
    const other = await createUser("DIRECTOR_AREA");
    const now = new Date("2026-11-04T15:00:00Z");
    await prisma.task.createMany({
      data: [
        { userId: me.id, title: "Llamar a la escuela", dueDate: new Date("2026-11-02T13:00:00Z") },
        { userId: me.id, title: "Reunión de equipo", dueDate: new Date("2026-11-04T17:00:00Z") },
        { userId: me.id, title: "Visita", dueDate: new Date("2026-11-08T13:00:00Z") },
        { userId: me.id, title: "Ordenar carpetas" },
        { userId: me.id, title: "Ya hecha", status: "COMPLETADA", dueDate: new Date("2026-11-04T13:00:00Z") },
        { userId: other.id, title: "De otra persona", dueDate: new Date("2026-11-04T13:00:00Z") },
      ],
    });
    const res = await handleMyTasksQuery({ id: me.id }, now);
    expect(res.answer).toContain("Tenés **4 tareas pendientes**.");
    expect(res.answer).toContain("#### Atrasadas (1)\n- Llamar a la escuela · 02/11/2026");
    expect(res.answer).toContain("#### Para hoy (1)\n- Reunión de equipo · 04/11/2026");
    expect(res.answer).toContain("#### En los próximos 7 días (1)\n- Visita · 08/11/2026");
    expect(res.answer).toContain("1 tarea sin fecha.");
    expect(res.answer).not.toContain("Ya hecha");
    expect(res.answer).not.toContain("De otra persona");
  });

  it("avisa qué está buscando y responde sin pasar por la IA", async () => {
    const statuses: string[] = [];
    const chunks: string[] = [];
    const res = await queryAIAssistantStream("¿Quién está de licencia o de vacaciones hoy?", [], undefined, (c) => chunks.push(c), {
      role: "SUPERADMIN",
      onStatus: (s) => statuses.push(s),
    });
    expect(statuses).toEqual(["Buscando en Licencias y vacaciones…"]);
    expect(res.intent).toBe("leaves_query");
    expect(chunks.join("")).toBe(res.answer);
  });
});
