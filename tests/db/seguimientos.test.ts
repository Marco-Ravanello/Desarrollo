import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { completeFollowUp, getCaseFollowUps, notifyDueFollowUps, scheduleFollowUp } from "@/services/follow-ups";
import { getCaseEvents } from "@/services/case-timeline";
import { getRecentItems } from "@/services/recent-views";
import { createArea, createUser } from "./helpers";

// Expedientes y personas inventados, solo en la base de prueba local.
const AHORA = new Date("2026-10-21T15:00:00Z");

describe("seguimientos agendados desde el expediente", () => {
  let yo: Awaited<ReturnType<typeof createUser>>;
  let otra: Awaited<ReturnType<typeof createUser>>;
  let caso: { id: string };
  let cerrado: { id: string };
  let vg: { id: string };

  beforeAll(async () => {
    const social = await createArea("Protección Social (prueba seguimientos)");
    const violencia = await createArea("Violencia de Género (prueba seguimientos)");
    yo = await createUser("OPERATIVO", social.id);
    otra = await createUser("OPERATIVO", social.id);
    const persona = await prisma.person.create({ data: { id: "97000001", dni: "97000001", firstName: "Sara", lastName: "Seguimiento" } });
    caso = await prisma.case.create({ data: { title: "Pedido de módulo", personId: persona.id, areaId: social.id } });
    cerrado = await prisma.case.create({ data: { title: "Ya cerrado", personId: persona.id, areaId: social.id, status: "CERRADO" } });
    vg = await prisma.case.create({ data: { title: "Reservado", personId: persona.id, areaId: violencia.id } });
  });

  it("queda como tarea propia unida al expediente y en su historia", async () => {
    const res = await scheduleFollowUp(yo, { caseId: caso.id, day: "2026-10-28", note: "Llamar a la titular" }, AHORA);
    expect(res).toEqual({ success: true });
    const tarea = await prisma.task.findFirstOrThrow({ where: { caseId: caso.id } });
    expect(tarea).toMatchObject({ userId: yo.id, title: "Llamar a la titular", status: "PENDIENTE" });
    expect(tarea.dueDate?.toISOString()).toBe("2026-10-28T12:00:00.000Z");

    const eventos = await getCaseEvents({ id: caso.id, createdAt: AHORA, areaName: "Protección Social" }, []);
    const seg = eventos.find((e) => e.kind === "SEGUIMIENTO");
    expect(seg).toMatchObject({ title: "Agendó un seguimiento para el 28/10/2026", detail: "Llamar a la titular" });
  });

  it("sin nota, la tarea lleva el nombre del expediente", async () => {
    await scheduleFollowUp(otra, { caseId: caso.id, day: "2026-10-21" }, AHORA);
    const lista = await getCaseFollowUps(caso.id, AHORA);
    expect(lista.map((f) => f.title)).toEqual(["Seguimiento: Pedido de módulo", "Llamar a la titular"]);
    expect(lista[0].userId).toBe(otra.id);
  });

  it("no se agenda en el pasado, en un expediente cerrado, sin permiso para Violencia de Género ni desde Auditoría", async () => {
    expect((await scheduleFollowUp(yo, { caseId: caso.id, day: "2026-10-20" }, AHORA)).success).toBe(false);
    expect(await scheduleFollowUp(yo, { caseId: cerrado.id, day: "2026-10-28" }, AHORA)).toEqual({
      success: false,
      error: "El expediente está cerrado. Reabrilo para agendar un seguimiento.",
    });
    expect(await scheduleFollowUp(yo, { caseId: vg.id, day: "2026-10-28" }, AHORA)).toEqual({ success: false, error: "No se encontró el expediente." });
    const auditoria = await createUser("AUDITOR");
    expect((await scheduleFollowUp(auditoria, { caseId: caso.id, day: "2026-10-28" }, AHORA)).success).toBe(false);
    const conPermiso = await createUser("VIOLENCIA_GENERO");
    expect((await scheduleFollowUp(conPermiso, { caseId: vg.id, day: "2026-10-28" }, AHORA)).success).toBe(true);
  });

  it("el día que vence avisa una sola vez, y los de más adelante esperan", async () => {
    expect(await notifyDueFollowUps(otra.id, AHORA)).toBe(1);
    expect(await notifyDueFollowUps(otra.id, AHORA)).toBe(0);
    const aviso = await prisma.notification.findFirstOrThrow({ where: { userId: otra.id } });
    expect(aviso).toMatchObject({ title: "Hoy tenés un seguimiento", message: "Expediente: Pedido de módulo", link: `/cases/${caso.id}` });

    expect(await notifyDueFollowUps(yo.id, AHORA)).toBe(0);
    expect(await notifyDueFollowUps(yo.id, new Date("2026-10-28T03:30:00Z"))).toBe(1);
    const mio = await prisma.notification.findFirstOrThrow({ where: { userId: yo.id } });
    expect(mio.message).toBe("Llamar a la titular (Pedido de módulo)");
  });

  it("solo quien lo agendó lo marca como hecho", async () => {
    const [deOtra] = await getCaseFollowUps(caso.id, AHORA);
    expect((await completeFollowUp(yo, deOtra.id)).success).toBe(false);
    expect(await completeFollowUp(otra, deOtra.id)).toEqual({ success: true, caseId: caso.id });
    expect((await getCaseFollowUps(caso.id, AHORA)).map((f) => f.userId)).toEqual([yo.id]);
  });
});

describe("vistos recientemente", () => {
  it("trae los datos en el mismo orden y deja afuera lo que no existe o no se puede ver", async () => {
    const area = await createArea("Niñez (prueba vistos)");
    const violencia = await createArea("Violencia (prueba vistos)");
    const p = await prisma.person.create({ data: { id: "97000010", dni: "97000010", firstName: "Vera", lastName: "Vista" } });
    // Una persona con id propio, cuya ficha se abrió por el DNI.
    await prisma.person.create({ data: { id: "persona-con-id", dni: "97000012", firstName: "Dina", lastName: "Porde" } });
    await prisma.padronUnificado.create({ data: { dni: "97000011", nombre_completo: "Padrón, Pablo" } });
    const c = await prisma.case.create({ data: { title: "Visto hace poco", personId: p.id, areaId: area.id } });
    const reservado = await prisma.case.create({ data: { title: "Reservado", personId: p.id, areaId: violencia.id } });

    const refs = [
      { kind: "person", id: "97000011" },
      { kind: "case", id: reservado.id },
      { kind: "case", id: c.id },
      { kind: "case", id: "no-existe" },
      { kind: "person", id: p.id },
      { kind: "person", id: "97000012" },
    ];
    const items = await getRecentItems(refs, false);
    expect(items.map((i) => [i.kind, i.title, i.subtitle, i.url])).toEqual([
      ["person", "Pablo Padrón", "DNI 97000011", "/people/97000011"],
      ["case", "Visto hace poco", "Vera Vista · Niñez (prueba vistos)", `/cases/${c.id}`],
      ["person", "Vera Vista", "DNI 97000010", `/people/${p.id}`],
      ["person", "Dina Porde", "DNI 97000012", "/people/97000012"],
    ]);
    expect((await getRecentItems(refs, true)).map((i) => i.id)).toContain(reservado.id);
    expect(await getRecentItems("cualquier cosa", true)).toEqual([]);
  });
});
