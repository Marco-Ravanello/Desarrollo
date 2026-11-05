import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { buildAssistantScope } from "@/lib/assistant-scope";
import { handleCasesTool } from "@/services/assistant/cases-tool";
import { getAllCases } from "@/services/cases";
import { queryAIAssistantStream } from "@/services/ai-assistant";
import { createArea, createUser } from "./helpers";

// Expedientes inventados, solo en la base de prueba local que se vacía en cada archivo.

const DAY = 86400000;

let seeded: ReturnType<typeof doSeed> | null = null;
/** Se carga una sola vez por archivo (la base se vacía entre archivos, no entre pruebas). */
const seed = () => (seeded ??= doSeed());

async function doSeed() {
  const ninez = await createArea("Dirección de Niñez");
  const habitat = await createArea("Dirección de Hábitat");
  const user = await createUser("SUPERADMIN");
  const person = await prisma.person.create({ data: { dni: "95000001", firstName: "Uno", lastName: "Prueba" } });
  const old = new Date(Date.now() - 120 * DAY);
  const mk = async (title: string, areaId: string, daysAgo: number | null) => {
    const c = await prisma.case.create({ data: { title, areaId, personId: person.id, status: "ABIERTO", priority: "MEDIA", createdAt: old } });
    if (daysAgo !== null) {
      await prisma.intervention.create({ data: { caseId: c.id, personId: person.id, userId: user.id, description: "Visita inventada", date: new Date(Date.now() - daysAgo * DAY) } });
    }
    return c;
  };
  const recent = await mk("Movido hace 2 días", ninez.id, 2);
  await mk("Movido hace 20 días", habitat.id, 20);
  await mk("Movido hace 45 días", ninez.id, 45);
  await mk("Nunca se movió", ninez.id, null);
  return { ninez, user, recent };
}

describe("expedientes con y sin movimiento", () => {
  it("cuenta y lista los que se movieron en los últimos días, con enlace", async () => {
    const { recent } = await seed();
    const admin = buildAssistantScope({ role: "SUPERADMIN" });

    const week = await handleCasesTool({ con_movimiento_dias: 7, listar: true }, admin);
    expect(week.answer).toContain("Hay **1 expediente abierto** con alguna intervención en los últimos 7 días.");
    expect(week.answer).toContain(`| [Movido hace 2 días](/cases/${recent.id}) | Dirección de Niñez | Media |`);
    expect(week.dataSummary.actions[0].payload.path).toBe("/cases?status=ACTIVOS&moved=7");

    const month = await handleCasesTool({ con_movimiento_dias: 30, listar: true }, admin);
    expect(month.answer).toContain("Hay **2 expedientes abiertos** con alguna intervención en los últimos 30 días.");
    // Los que se movieron hace menos, primero.
    expect(month.answer.indexOf("Movido hace 2 días")).toBeLessThan(month.answer.indexOf("Movido hace 20 días"));

    const quiet = await handleCasesTool({ sin_movimiento_dias: 40, listar: true }, admin);
    expect(quiet.answer).toContain("Hay **2 expedientes abiertos** sin movimiento hace 40 días o más.");
    expect(quiet.answer).toContain("Sin intervenciones");
    expect(quiet.dataSummary.actions[0].payload.path).toBe("/cases?status=ACTIVOS&quiet=40");

    // La lista de Expedientes muestra lo mismo con esos filtros.
    expect((await getAllCases({ moved: 7, canViewSensitive: true })).cases.map((c: any) => c.title)).toEqual(["Movido hace 2 días"]);
    expect((await getAllCases({ quiet: 40, canViewSensitive: true })).cases).toHaveLength(2);
  });

  it("la pregunta de la captura, como seguimiento, sin Gemini", async () => {
    await seed();
    const res = await queryAIAssistantStream("Y cuales son los que tuvieron moviiento en los últimos 30 días?", [{ role: "user", content: "¿Cuántos expedientes abiertos hay?" }], undefined, undefined, {
      role: "SUPERADMIN",
      previousCall: { tool: "expedientes", args: {} },
    });
    expect(res.intent).toBe("cases_query");
    expect(res.answer).toContain("con alguna intervención en los últimos 30 días");
    expect(res.answer).toContain("Movido hace 20 días");
    expect(res.dataSummary.call).toEqual({ tool: "expedientes", args: { con_movimiento_dias: 30, listar: true } });

    const area = await queryAIAssistantStream("¿Y de Niñez?", [], undefined, undefined, { role: "SUPERADMIN", previousCall: res.dataSummary.call });
    expect(area.answer).toContain("Hay **1 expediente abierto** de Dirección de Niñez, con alguna intervención en los últimos 30 días.");
  });
});
