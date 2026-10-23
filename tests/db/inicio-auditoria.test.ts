import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { parseAuditFilters, searchAuditLogs } from "@/services/audit";
import { getAreaOverview, getAreaTeam, getFollowUpsDue, getQuietCases } from "@/services/dashboard";
import { getAllCases } from "@/services/cases";
import { createArea, createUser } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada corrida.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("búsqueda en la Auditoría", () => {
  it("filtra por persona, tipo, fechas y texto, y oculta los ingresos salvo que se pidan", async () => {
    const a = await createUser("OPERATIVO");
    const b = await createUser("ADMIN_GENERAL");
    const area = await createArea("Área (prueba auditoría)");
    const caso = await prisma.case.create({ data: { title: "Pérez, Juana - Pedido de chapas", areaId: area.id } });
    await prisma.auditLog.createMany({
      data: [
        { userId: a.id, action: "CLOSE_CASE", entity: "Case", entityId: caso.id, details: "Se resolvió", createdAt: new Date("2026-10-20T15:00:00Z") },
        { userId: a.id, action: "UPDATE", entity: "Persona", entityId: "30111222", details: '{"dni":"30111222"}', createdAt: new Date("2026-10-21T02:30:00Z") },
        { userId: b.id, action: "PURCHASE_ORDER_STATUS_APROBADA", entity: "PurchaseOrder", entityId: "po1", createdAt: new Date("2026-10-22T12:00:00Z") },
        { userId: b.id, action: "LOGIN", entity: "User", entityId: b.id, createdAt: new Date("2026-10-22T13:00:00Z") },
      ],
    });

    const all = await searchAuditLogs(parseAuditFilters({}));
    expect(all.total).toBe(3);
    expect(all.rows[0].action).toBe("PURCHASE_ORDER_STATUS_APROBADA");

    expect((await searchAuditLogs(parseAuditFilters({ ingresos: "1" }))).total).toBe(4);
    expect((await searchAuditLogs(parseAuditFilters({ tipo: "ingresos" }))).total).toBe(1);
    expect((await searchAuditLogs(parseAuditFilters({ persona: a.id }))).total).toBe(2);
    expect((await searchAuditLogs(parseAuditFilters({ tipo: "compras" }))).rows.map((r) => r.entityId)).toEqual(["po1"]);
    expect((await searchAuditLogs(parseAuditFilters({ tipo: "personas" }))).rows.map((r) => r.entityId)).toEqual(["30111222"]);

    // 21/10 02:30 UTC todavía es el 20/10 en Argentina.
    const day20 = await searchAuditLogs(parseAuditFilters({ desde: "2026-10-20", hasta: "2026-10-20" }));
    expect(day20.rows.map((r) => r.action).sort()).toEqual(["CLOSE_CASE", "UPDATE"]);

    expect((await searchAuditLogs(parseAuditFilters({ q: "30111222" }))).total).toBe(1);
    expect((await searchAuditLogs(parseAuditFilters({ q: "chapas" }))).rows.map((r) => r.action)).toEqual(["CLOSE_CASE"]);
    expect(parseAuditFilters({ tipo: "inventado", desde: "ayer" })).toMatchObject({ group: undefined, from: undefined });
  });
});

describe("inicio por rol", () => {
  it("cuenta por área los abiertos, urgentes, quietos y derivaciones, y deja afuera Violencia de Género sin permiso", async () => {
    const social = await createArea("Protección Social (prueba inicio)");
    const vg = await createArea("Violencia de Género (prueba inicio)");
    await prisma.case.create({ data: { title: "Urgente", areaId: social.id, priority: "URGENTE" } });
    await prisma.case.create({ data: { title: "Quieto", areaId: social.id, createdAt: daysAgo(45) } });
    await prisma.case.create({ data: { title: "Cerrado", areaId: social.id, status: "CERRADO", createdAt: daysAgo(90) } });
    const vgCase = await prisma.case.create({ data: { title: "Reservado", areaId: vg.id } });
    await prisma.derivation.create({ data: { caseId: vgCase.id, fromAreaId: vg.id, toAreaId: social.id, reason: "Prueba" } });

    const rows = await getAreaOverview({ canViewSensitive: false });
    expect(rows.find((r) => r.id === vg.id)).toBeUndefined();
    expect(rows.find((r) => r.id === social.id)).toMatchObject({ open: 2, urgent: 1, stale: 1, derivations: 1 });
    expect((await getAreaOverview({ canViewSensitive: true })).find((r) => r.id === vg.id)).toMatchObject({ open: 1 });
  });

  it("el equipo del área muestra cuántos tiene cada profesional y los que no tienen a nadie", async () => {
    const area = await createArea("Hábitat (prueba equipo)");
    const otra = await createArea("Otra (prueba equipo)");
    const ana = await createUser("OPERATIVO", area.id);
    const sinNada = await createUser("OPERATIVO", area.id);
    const deOtra = await createUser("OPERATIVO", otra.id);
    await prisma.user.update({ where: { id: ana.id }, data: { name: "Ana Prueba" } });
    await prisma.case.create({ data: { title: "Uno", areaId: area.id, assignedToId: ana.id } });
    await prisma.case.create({ data: { title: "Dos", areaId: area.id, assignedToId: ana.id, createdAt: daysAgo(40) } });
    await prisma.case.create({ data: { title: "Derivado", areaId: area.id, assignedToId: deOtra.id } });
    await prisma.case.create({ data: { title: "Sin nadie", areaId: area.id } });
    await prisma.case.create({ data: { title: "Cerrado", areaId: area.id, assignedToId: sinNada.id, status: "CERRADO" } });

    const team = await getAreaTeam({ areaId: area.id, canViewSensitive: true });
    expect(team[0]).toMatchObject({ userId: ana.id, name: "Ana Prueba", open: 2, stale: 1 });
    expect(team.find((r) => r.userId === deOtra.id)).toMatchObject({ open: 1 });
    expect(team.find((r) => r.userId === sinNada.id)).toMatchObject({ open: 0 });
    expect(team.at(-1)).toMatchObject({ userId: null, name: "Sin profesional a cargo", open: 1 });
  });

  it("los expedientes quietos van primero los más quietos, y el filtro de la lista coincide", async () => {
    const area = await createArea("Niñez (prueba quietos)");
    const persona = await prisma.person.create({ data: { id: "95000101", dni: "95000101", firstName: "Leo", lastName: "Prueba" } });
    const user = await createUser("OPERATIVO", area.id);
    await prisma.case.create({ data: { title: "Muy quieto", areaId: area.id, createdAt: daysAgo(80) } });
    await prisma.case.create({ data: { title: "Quieto", areaId: area.id, personId: persona.id, createdAt: daysAgo(35) } });
    const conMovimiento = await prisma.case.create({ data: { title: "Con movimiento", areaId: area.id, personId: persona.id, createdAt: daysAgo(60) } });
    await prisma.intervention.create({ data: { caseId: conMovimiento.id, personId: persona.id, description: "Visita", userId: user.id, date: daysAgo(3) } });
    await prisma.case.create({ data: { title: "Nuevo", areaId: area.id } });

    const quiet = await getQuietCases({ areaId: area.id, canViewSensitive: true });
    expect(quiet.map((c) => c.title)).toEqual(["Muy quieto", "Quieto"]);
    expect(quiet[1]).toMatchObject({ titular: "Prueba, Leo", assignee: null, quietDays: 35 });

    const list = await getAllCases({ areaId: area.id, quiet: true, canViewSensitive: true });
    expect(list.cases.map((c: any) => c.title).sort()).toEqual(["Muy quieto", "Quieto"]);
  });

  it("los seguimientos que vencen hoy o ya vencieron, sin los hechos ni los de otra persona", async () => {
    const area = await createArea("Área (prueba seguimientos)");
    const yo = await createUser("OPERATIVO", area.id);
    const otro = await createUser("OPERATIVO", area.id);
    const caso = await prisma.case.create({ data: { title: "Con seguimiento", areaId: area.id } });
    const now = new Date("2026-10-23T15:00:00Z");
    await prisma.task.createMany({
      data: [
        { userId: yo.id, caseId: caso.id, title: "Hoy", dueDate: new Date("2026-10-23T12:00:00Z") },
        { userId: yo.id, caseId: caso.id, title: "Atrasado", dueDate: new Date("2026-10-20T12:00:00Z") },
        { userId: yo.id, caseId: caso.id, title: "Mañana", dueDate: new Date("2026-10-24T12:00:00Z") },
        { userId: yo.id, caseId: caso.id, title: "Hecho", dueDate: new Date("2026-10-22T12:00:00Z"), status: "COMPLETADA" },
        { userId: yo.id, title: "Tarea suelta", dueDate: new Date("2026-10-22T12:00:00Z") },
        { userId: otro.id, caseId: caso.id, title: "De otro", dueDate: new Date("2026-10-22T12:00:00Z") },
      ],
    });
    const due = await getFollowUpsDue(yo.id, now);
    expect(due.map((t) => [t.title, t.overdueDays])).toEqual([["Atrasado", 3], ["Hoy", 0]]);
    expect(due[0].caseTitle).toBe("Con seguimiento");
  });
});
