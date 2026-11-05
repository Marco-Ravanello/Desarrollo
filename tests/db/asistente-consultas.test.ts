import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { buildAssistantScope } from "@/lib/assistant-scope";
import { handleCasesTool } from "@/services/assistant/cases-tool";
import { handleBudgetQuery } from "@/services/assistant/intent-handlers";
import { confirmReservationProposal, confirmTaskProposal, proposeReservation, proposeTask } from "@/services/assistant/proposals";
import { queryAIAssistantStream } from "@/services/ai-assistant";
import { createArea, createUser } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo. Gemini no se llama de verdad:
// se reemplaza su respuesta.

async function seedCases() {
  const ninez = await createArea("Dirección de Niñez");
  const habitat = await createArea("Dirección de Hábitat");
  const vg = await createArea("Coordinación de Violencia de Género");
  const person = await prisma.person.create({ data: { dni: "94000001", firstName: "Uno", lastName: "Prueba" } });
  await prisma.person.create({ data: { dni: "94000002", firstName: "Dos", lastName: "Prueba" } });
  const mk = (areaId: string, priority: "URGENTE" | "MEDIA", labels: string[] = []) =>
    prisma.case.create({ data: { title: "Caso inventado", areaId, personId: person.id, priority, status: "ABIERTO", labels } });
  await mk(ninez.id, "URGENTE", ["NINEZ"]);
  await mk(ninez.id, "MEDIA", ["NINEZ", "DISCAPACIDAD"]);
  await mk(habitat.id, "URGENTE");
  await mk(vg.id, "URGENTE");
  return { ninez, habitat, vg };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("expedientes con filtros", () => {
  it("cuenta, agrupa y grafica con los filtros, y el Director ve solo su área", async () => {
    const { ninez } = await seedCases();
    const all = await handleCasesTool({ prioridad: "URGENTE", agrupar_por: "area", grafico: true }, buildAssistantScope({ role: "SUPERADMIN" }));
    expect(all.answer).toContain("Hay **3 expedientes abiertos** de prioridad urgente.");
    expect(all.answer).toMatch(/\| \[Coordinación de Violencia de Género\]\(\/cases\?status=ACTIVOS&priority=URGENTE&area=[^)]+\) \| 1 \|/);
    expect(all.dataSummary.chart.data).toHaveLength(3);
    expect(all.dataSummary.chart.columns).toEqual(["Área", "Expedientes"]);
    expect(all.dataSummary.stats).toEqual([{ label: "Expedientes abiertos", value: "3", href: "/cases?status=ACTIVOS&priority=URGENTE" }]);
    const byPriority = await handleCasesTool({ agrupar_por: "prioridad", grafico: true }, buildAssistantScope({ role: "SUPERADMIN" }));
    expect(byPriority.dataSummary.chart.data).toEqual([
      { name: "Urgente", value: 3, tone: "red" },
      { name: "Media", value: 1, tone: "slate" },
    ]);
    expect(all.dataSummary.actions[0].payload.path).toBe("/cases?status=ACTIVOS&priority=URGENTE");
    expect(all.answer).not.toContain("Caso inventado");

    const director = buildAssistantScope({ role: "DIRECTOR_AREA", areaId: ninez.id });
    const own = await handleCasesTool({ agrupar_por: "etiqueta" }, director);
    expect(own.answer).toContain("Hay **2 expedientes abiertos**.");
    expect(own.answer).toContain("| [Niñez y adolescencia](/cases?status=ACTIVOS&label=NINEZ) | 2 |");
    expect(own.answer).toContain("| [Discapacidad](/cases?status=ACTIVOS&label=DISCAPACIDAD) | 1 |");
    expect(own.answer).not.toContain("Hábitat");
    expect(own.answer).toContain("Te muestro solo los datos de tu área.");

    const other = await handleCasesTool({ area: "Hábitat" }, director);
    expect(other.answer).toBe("Solo puedo mostrarte los expedientes de tu área, como en el resto de la app.");

    const noArea = await handleCasesTool({ prioridad: "URGENTE" }, buildAssistantScope({ role: "DIRECTOR_AREA", areaId: null }));
    expect(noArea.answer).toContain("no tiene un área cargada");
  });

  it("las compras del Director son solo las de su área", async () => {
    const a = await createArea("Dirección de Deportes");
    const b = await createArea("Dirección de Cultura");
    await prisma.purchaseOrder.create({ data: { number: "9001", areaId: a.id, amount: 1000, status: "APROBADA", providerName: "Proveedor Uno" } });
    await prisma.purchaseOrder.create({ data: { number: "9002", areaId: b.id, amount: 5000, status: "APROBADA", providerName: "Proveedor Dos" } });
    const res = await handleBudgetQuery("lista de ordenes", buildAssistantScope({ role: "DIRECTOR_AREA", areaId: a.id }));
    expect(res.answer).toContain("OC #9001");
    expect(res.answer).not.toContain("OC #9002");
    const all = await handleBudgetQuery("lista de ordenes", buildAssistantScope({ role: "SUPERADMIN" }));
    expect(all.answer).toContain("OC #9002");
  });
});

describe("el asistente sigue los permisos de cada rol", () => {
  it("al Director no le contesta sobre Recursos Humanos ni le muestra los nombres", async () => {
    await prisma.hRRecord.create({ data: { dni: "94100001", firstName: "Agente", lastName: "Inventado", contractType: "MENSUALIZADO", status: "LICENCIA" } });
    const area = await createArea("Dirección de Prueba");
    const res = await queryAIAssistantStream("¿Quién está de licencia hoy?", [], undefined, undefined, { role: "DIRECTOR_AREA", areaId: area.id });
    expect(res.intent).toBe("access_denied");
    expect(res.answer).toContain("la ve solo la conducción");
    expect(res.answer).not.toContain("Inventado");
  });

  it("\"ayuda alimentaria\" no se toma como un saludo", async () => {
    const res = await queryAIAssistantStream("¿Cuántas personas reciben ayuda alimentaria?", [], undefined, undefined, { role: "SUPERADMIN" });
    expect(res.intent).not.toBe("greeting");
  });
});

describe("Gemini elige la consulta", () => {
  it("usa la consulta y los filtros que eligió, sin mandarle datos de la base", async () => {
    // Los expedientes de la primera prueba siguen en la base: 3 urgentes abiertos.
    vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
    const bodies: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: any) => {
        bodies.push(JSON.parse(init.body));
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: "expedientes", args: { prioridad: "URGENTE", agrupar_por: "area", sql: "x" } } }] } }] }),
          { status: 200 }
        );
      })
    );
    const statuses: string[] = [];
    const res = await queryAIAssistantStream("Los casos más graves, ¿en qué áreas están? Hay uno de DNI 94000002", [], undefined, undefined, {
      role: "SUPERADMIN",
      onStatus: (s) => statuses.push(s),
    });
    expect(res.intent).toBe("cases_query");
    expect(res.dataSummary.via).toBe("gemini");
    expect(res.answer).toContain("Hay **3 expedientes abiertos** de prioridad urgente.");
    expect(statuses).toEqual(["Entendiendo la pregunta…", "Buscando en Expedientes…"]);
    // Una sola llamada: la que elige. La respuesta sale armada por la app.
    expect(bodies).toHaveLength(1);
    const sent = JSON.stringify(bodies[0].contents);
    expect(sent).toContain("[DNI_1]");
    expect(sent).not.toContain("94000002");
    expect(sent).not.toContain("Caso inventado");
    expect(bodies[0].tools[0].functionDeclarations.length).toBeGreaterThan(10);
  });

  it("si Gemini no responde, elige por palabras", async () => {
    vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("caído", { status: 503 })));
    const res = await queryAIAssistantStream("¿Qué cursos y talleres están abiertos?", [], undefined, undefined, { role: "SUPERADMIN" });
    expect(res.intent).toBe("courses_query");
    expect(res.dataSummary.via).toBe("palabras");
  });
});

describe("tareas y pedidos de vehículo con confirmación", () => {
  const now = new Date("2026-11-05T12:00:00Z");

  it("la tarea no se guarda hasta confirmar", async () => {
    const user = await createUser("DIRECTOR_AREA");
    const res = await proposeTask({ titulo: "Llamar a la escuela", fecha: "2026-11-06", hora: "10:00" }, "", user.id);
    expect(res.intent).toBe("task_proposal");
    expect(res.dataSummary.proposal).toMatchObject({ kind: "tarea", titulo: "Llamar a la escuela", fecha: "2026-11-06", hora: "10:00" });
    expect(await prisma.task.count({ where: { userId: user.id } })).toBe(0);

    const ok = await confirmTaskProposal({ id: user.id }, res.dataSummary.proposal);
    expect(ok.ok).toBe(true);
    const task = await prisma.task.findFirstOrThrow({ where: { userId: user.id } });
    expect(task.title).toBe("Llamar a la escuela");
    expect(task.dueDate?.toISOString()).toBe("2026-11-06T13:00:00.000Z");
    expect(await confirmTaskProposal({ id: user.id }, { kind: "tarea", titulo: "  " })).toEqual({ ok: false, error: "La tarea necesita un título." });
  });

  it("elige un vehículo libre, lo deja pendiente al confirmar y revisa de nuevo el horario", async () => {
    const user = await createUser("DIRECTOR_AREA");
    const other = await createUser("ADMIN_GENERAL");
    const busy = await prisma.vehicle.create({ data: { plate: "AAA001", brand: "Fiat", model: "Uno" } });
    await prisma.vehicle.create({ data: { plate: "AAA000", brand: "Renault", model: "Kangoo", status: "EN_TALLER" } });
    const free = await prisma.vehicle.create({ data: { plate: "AAA002", brand: "Ford", model: "Ka" } });
    await prisma.vehicleReservation.create({
      data: { vehicleId: busy.id, userId: other.id, startDate: new Date("2026-11-06T11:00:00Z"), endDate: new Date("2026-11-06T16:00:00Z"), reason: "x", status: "APROBADA" },
    });

    const res = await proposeReservation({ fecha: "2026-11-06", hora_salida: "09:00", hora_vuelta: "12:00" }, "", user.id, now);
    expect(res.intent).toBe("reservation_proposal");
    expect(res.dataSummary.proposal).toMatchObject({ kind: "reserva", vehicleId: free.id, salida: "2026-11-06T12:00:00.000Z", vuelta: "2026-11-06T15:00:00.000Z" });
    expect(await prisma.vehicleReservation.count({ where: { userId: user.id } })).toBe(0);

    const byPlate = await proposeReservation({ fecha: "2026-11-06", hora_salida: "09:00", patente: "aaa 001" }, "", user.id, now);
    expect(byPlate.intent).toBe("reservation_error");
    expect(byPlate.answer).toContain("ya está reservado");

    const past = await proposeReservation({ fecha: "2026-11-01", hora_salida: "09:00" }, "", user.id, now);
    expect(past.answer).toBe("Ese horario ya pasó. Decime otro día u otra hora.");
    const noDate = await proposeReservation({ motivo: "Visita" }, "", user.id, now);
    expect(noDate.intent).toBe("reservation_question");

    // Mientras tanto alguien aprobó otra reserva del mismo vehículo: al confirmar se avisa y no se guarda.
    const blocker = await prisma.vehicleReservation.create({
      data: { vehicleId: free.id, userId: other.id, startDate: new Date("2026-11-06T13:00:00Z"), endDate: new Date("2026-11-06T14:00:00Z"), reason: "x", status: "APROBADA" },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      const fail = await confirmReservationProposal({ id: user.id }, res.dataSummary.proposal);
      expect(fail.ok).toBe(false);
      await prisma.vehicleReservation.delete({ where: { id: blocker.id } });
      const ok = await confirmReservationProposal({ id: user.id, name: "Prueba" }, res.dataSummary.proposal);
      expect(ok).toMatchObject({ ok: true, link: "/admin/vehicles" });
    } finally {
      vi.useRealTimers();
    }
    const saved = await prisma.vehicleReservation.findFirstOrThrow({ where: { userId: user.id } });
    expect(saved.status).toBe("PENDIENTE");
    expect(saved.reason).toBe("Pedido desde el Asistente de IA");
    expect(await prisma.notification.count({ where: { userId: other.id, title: "Nuevo pedido de vehículo" } })).toBe(1);
  });

  it("sin Gemini, el pedido sale de la pregunta: \"el viernes de 9 a 12\"", async () => {
    const user = await createUser("DIRECTOR_AREA");
    await prisma.vehicle.create({ data: { plate: "BBB001", brand: "Fiat", model: "Uno" } });
    const res = await queryAIAssistantStream("Reservame un auto el viernes de 9 a 12", [], user.id, undefined, { role: "DIRECTOR_AREA" });
    expect(res.intent).toBe("reservation_proposal");
    const p = res.dataSummary.proposal;
    expect(new Date(p.vuelta).getTime() - new Date(p.salida).getTime()).toBe(3 * 3600000);
    expect(new Date(p.salida).toISOString().slice(11, 16)).toBe("12:00");
    expect(await prisma.vehicleReservation.count({ where: { userId: user.id } })).toBe(0);
  });
});
