import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { registerLeave, deleteLeave, ensureLeaveForStatus, getAbsencesForMonth, getLeavesFor, syncLeaveStatuses, pendingReturnWhere } from "@/services/hr-leaves";
import { getHRRecords, markBackFromLeave } from "@/services/hr";
import { createArea, createUser } from "./helpers";
import { diaAR } from "@/lib/fechas";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.
// "Hoy" es el 4/11/2026 a las 13 h de Argentina.
const NOW = new Date("2026-11-04T16:00:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const base = { contractType: "MENSUALIZADO" as const, lastName: "Prueba" };

describe("licencias y vacaciones", () => {
  it("registra, no deja pisar otra, cambia la situación si es de hoy y la vuelve a Activo al borrarla", async () => {
    const admin = await createUser("ADMIN_GENERAL");
    const dg = await createUser("DIRECCION_GENERAL");
    const a = await prisma.hRRecord.create({ data: { ...base, dni: "91000001", firstName: "Ana" } });

    expect(await registerLeave(dg, a.id, { kind: "VACACIONES", startDate: "2026-11-02", endDate: "2026-11-06" }, NOW)).toMatchObject({ success: false });

    // Una futura no toca la situación.
    expect(await registerLeave(admin, a.id, { kind: "VACACIONES", startDate: "2026-12-14", endDate: "2026-12-31" }, NOW)).toEqual({ success: true });
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "ACTIVO", statusUntil: null });

    // La de hoy sí, hasta su último día.
    expect(await registerLeave(admin, a.id, { kind: "ENFERMEDAD", startDate: "2026-11-03", endDate: "2026-11-06", notes: "Certificado" }, NOW)).toEqual({ success: true });
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "LICENCIA", statusUntil: day("2026-11-06") });

    const clash = await registerLeave(admin, a.id, { kind: "ESTUDIO", startDate: "2026-11-06", endDate: "2026-11-06" }, NOW);
    expect(clash).toMatchObject({ success: false, error: expect.stringContaining("Se pisa con otra licencia ya cargada (Licencia médica, del 03/11/2026 al 06/11/2026)") });

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "HR_LICENCIA", details: { contains: "Licencia médica" } } });
    expect(log.details).toBe("Prueba, Ana: Licencia médica del 03/11/2026 al 06/11/2026 (4 días).");

    const leaves = await getLeavesFor(a.id);
    expect(leaves.map((l) => l.kind)).toEqual(["VACACIONES", "ENFERMEDAD"]);
    expect(await deleteLeave(admin, leaves[1].id, NOW)).toEqual({ success: true });
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "ACTIVO", statusUntil: null });
    expect(await prisma.auditLog.count({ where: { action: "HR_LICENCIA_BORRADA" } })).toBe(1);
  });

  it("si el legajo se guarda de licencia con fecha, la suma al historial una sola vez", async () => {
    const b = await prisma.hRRecord.create({ data: { ...base, dni: "91000002", firstName: "Beto" } });
    expect(await ensureLeaveForStatus(b.id, "VACACIONES", day("2026-11-10"), null, NOW)).toBe(true);
    expect(await ensureLeaveForStatus(b.id, "VACACIONES", day("2026-11-10"), null, NOW)).toBe(false);
    expect(await ensureLeaveForStatus(b.id, "ACTIVO", null, null, NOW)).toBe(false);
    const [l] = await getLeavesFor(b.id);
    expect(l).toMatchObject({ kind: "VACACIONES", startDate: day("2026-11-04"), endDate: day("2026-11-10") });
  });

  it("\"Ya volvió\" corta la licencia de hoy en el día de ayer", async () => {
    const admin = await createUser("SUPERADMIN");
    const c = await prisma.hRRecord.create({ data: { ...base, dni: "91000003", firstName: "Caro" } });
    // Con el reloj de verdad (markBackFromLeave usa la fecha de hoy): empezó hace 3 días, queda hasta ayer.
    const iso = (n: number) => new Date(Date.parse(`${diaAR()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    await registerLeave(admin, c.id, { kind: "ENFERMEDAD", startDate: iso(-3), endDate: iso(10) });
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "LICENCIA" });
    expect(await markBackFromLeave(admin, c.id)).toEqual({ success: true });
    const [l] = await getLeavesFor(c.id);
    expect(l.endDate).toEqual(day(iso(-1)));
    // Si empezaba hoy, no llegó a faltar: se borra.
    const e = await prisma.hRRecord.create({ data: { ...base, dni: "91000007", firstName: "Gabi" } });
    await registerLeave(admin, e.id, { kind: "VACACIONES", startDate: iso(0), endDate: iso(5) });
    expect(await markBackFromLeave(admin, e.id)).toEqual({ success: true });
    expect(await getLeavesFor(e.id)).toEqual([]);
  });

  it("arma el calendario del mes por área", async () => {
    const admin = await createUser("ADMIN_GENERAL");
    const area1 = await createArea("Área ausencias 1");
    const area2 = await createArea("Área ausencias 2");
    const d1 = await prisma.hRRecord.create({ data: { ...base, dni: "91000004", firstName: "Dani", areaId: area1.id } });
    const d2 = await prisma.hRRecord.create({ data: { ...base, dni: "91000005", firstName: "Eva", areaId: area2.id } });
    // Legajo de antes del historial: figura de vacaciones sin licencia cargada.
    await prisma.hRRecord.create({ data: { ...base, dni: "91000006", firstName: "Fede", areaId: area1.id, status: "VACACIONES", statusUntil: day("2026-11-08") } });
    await registerLeave(admin, d1.id, { kind: "VACACIONES", startDate: "2026-10-28", endDate: "2026-11-03" }, NOW);
    await registerLeave(admin, d2.id, { kind: "ESTUDIO", startDate: "2026-11-20", endDate: "2026-11-20" }, NOW);

    const all = await getAbsencesForMonth(2026, 11, null, NOW);
    const dani = all.find((r) => r.id === d1.id)!;
    expect(dani.spans.map((s) => [s.from, s.to])).toEqual([[1, 3]]);
    const fede = all.find((r) => r.name === "Prueba, Fede")!;
    expect(fede).toMatchObject({ fromStatus: true });
    expect(fede.spans.map((s) => [s.from, s.to])).toEqual([[4, 8]]);

    const only1 = await getAbsencesForMonth(2026, 11, area1.id, NOW);
    expect(only1.map((r) => r.name)).toEqual(["Prueba, Dani", "Prueba, Fede"]);
    expect(await getAbsencesForMonth(2026, 9, null, NOW)).toEqual([]);
  });

  it("cuando arranca una licencia cambia la situación sola, pero la vuelta a Activo hay que confirmarla", async () => {
    const admin = await createUser("ADMIN_GENERAL");
    const h = await prisma.hRRecord.create({ data: { ...base, dni: "91000008", firstName: "Hugo" } });
    const i = await prisma.hRRecord.create({ data: { ...base, dni: "91000009", firstName: "Iris", status: "BAJA" } });
    // Cargadas el 4/11 para más adelante: no cambian nada todavía.
    await registerLeave(admin, h.id, { kind: "SIN_GOCE", startDate: "2026-11-09", endDate: "2026-11-13" }, NOW);
    await registerLeave(admin, i.id, { kind: "VACACIONES", startDate: "2026-11-09", endDate: "2026-11-13" }, NOW);
    await syncLeaveStatuses(NOW);
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ status: "ACTIVO" });

    // El 9/11 arrancan: Hugo pasa a Licencia sin goce; Iris, de baja, sigue igual.
    const monday = new Date("2026-11-09T12:00:00Z");
    expect(await syncLeaveStatuses(monday)).toBeGreaterThanOrEqual(1);
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ status: "LICENCIA_SIN_GOCE", statusUntil: day("2026-11-13") });
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: i.id } })).toMatchObject({ status: "BAJA" });
    expect(await syncLeaveStatuses(monday)).toBe(0);

    // El 16/11 ya terminó: sigue figurando de licencia hasta que alguien confirme la vuelta.
    const after = new Date("2026-11-16T12:00:00Z");
    await syncLeaveStatuses(after);
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ status: "LICENCIA_SIN_GOCE" });
    const pending = await prisma.hRRecord.findMany({ where: pendingReturnWhere(after), select: { id: true } });
    expect(pending.map((p) => p.id)).toContain(h.id);

    // Si después arranca otra licencia, la situación se pone al día con la nueva.
    await registerLeave(admin, h.id, { kind: "VACACIONES", startDate: "2026-11-16", endDate: "2026-11-20" }, after);
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ status: "VACACIONES", statusUntil: day("2026-11-20") });
  });

  it("la lista filtra a quienes falta confirmar la vuelta", async () => {
    await prisma.hRRecord.create({ data: { ...base, dni: "91000010", firstName: "Juan", status: "LICENCIA", statusUntil: day("2020-01-10") } });
    const rows = await getHRRecords({ status: "volver" });
    expect(rows.map((r) => r.firstName)).toContain("Juan");
    expect(rows.every((r) => r.statusUntil && r.statusUntil < new Date())).toBe(true);
    // Un estado que no existe no rompe la lista.
    expect(Array.isArray(await getHRRecords({ status: "CUALQUIERA" }))).toBe(true);
  });
});
