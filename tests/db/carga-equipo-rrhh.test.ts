import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getTeamWorkload, getUnassignedCases } from "@/services/team-workload";
import { getAssignableUsers } from "@/services/case-assignment";
import { getHRStats } from "@/services/hr";
import { currentMonthRange } from "@/lib/hr-labels";
import { createArea, createUser } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("carga del equipo", () => {
  it("cuenta por profesional los abiertos, urgentes, quietos y recién asignados", async () => {
    const area = await createArea("Área (prueba carga del equipo)");
    const otra = await createArea("Otra área (prueba carga del equipo)");
    const ana = await prisma.user.create({ data: { email: "ana@prueba.test", name: "Ana Prueba", role: "OPERATIVO", areaId: area.id } });
    const beto = await prisma.user.create({ data: { email: "beto@prueba.test", name: "Beto Prueba", role: "OPERATIVO", areaId: area.id } });
    const dire = await prisma.user.create({ data: { email: "dire@prueba.test", name: "Dire Prueba", role: "DIRECTOR_AREA", areaId: area.id } });
    await prisma.user.create({ data: { email: "baja@prueba.test", name: "Baja Prueba", role: "OPERATIVO", areaId: area.id, isActive: false } });
    const dg = await createUser("DIRECCION_GENERAL");

    const nuevo = (data: Record<string, unknown>) => prisma.case.create({ data: { title: "Caso", areaId: area.id, ...data } as any });
    await nuevo({ assignedToId: ana.id, assignedAt: daysAgo(1), priority: "URGENTE" });
    await nuevo({ assignedToId: ana.id, assignedAt: daysAgo(20), createdAt: daysAgo(45) });
    await nuevo({ assignedToId: ana.id, status: "CERRADO" });
    await nuevo({ assignedToId: beto.id, assignedAt: daysAgo(3) });
    await nuevo({ assignedToId: dg.id });
    await nuevo({ title: "Sin nadie viejo", createdAt: daysAgo(60) });
    await nuevo({ title: "Sin nadie urgente", priority: "URGENTE", createdAt: daysAgo(2) });
    await nuevo({ title: "Sin nadie alta", priority: "ALTA", createdAt: daysAgo(10) });
    await prisma.case.create({ data: { title: "De otra área", areaId: otra.id } });

    const w = await getTeamWorkload({ areaId: area.id, canViewSensitive: true });
    expect(w).not.toBeNull();
    const byName = Object.fromEntries(w!.rows.map((r) => [r.name, r]));
    expect(Object.keys(byName).sort()).toEqual(["Ana Prueba", "Beto Prueba", "Dire Prueba", "Prueba DIRECCION_GENERAL"]);
    expect(byName["Ana Prueba"]).toMatchObject({ open: 2, urgent: 1, stale: 1, recent: 1, member: true, eligible: true });
    expect(byName["Beto Prueba"]).toMatchObject({ open: 1, urgent: 0, stale: 0, recent: 1 });
    expect(byName["Dire Prueba"]).toMatchObject({ open: 0, role: "DIRECTOR_AREA" });
    expect(byName["Prueba DIRECCION_GENERAL"]).toMatchObject({ open: 1, member: false });
    expect(w!.rows[0].name).toBe("Ana Prueba");
    expect(w!.unassigned).toEqual({ open: 3, urgent: 1, stale: 1 });
    expect(w!.totals).toEqual({ open: 7, urgent: 2, stale: 2 });

    const sinNadie = await getUnassignedCases({ areaId: area.id, canViewSensitive: true });
    expect(sinNadie.map((c) => c.title)).toEqual(["Sin nadie urgente", "Sin nadie alta", "Sin nadie viejo"]);
    expect(sinNadie[2]).toMatchObject({ openDays: 60, quietDays: 60, titular: null });

    // Al asignar desde el expediente se ve cuántos abiertos tiene cada uno.
    const options = await getAssignableUsers({ areaId: area.id, areaName: area.name });
    expect(options.find((o) => o.id === ana.id)).toMatchObject({ open: 2, sameArea: true, role: "OPERATIVO" });
    expect(options.find((o) => o.id === dire.id)).toMatchObject({ open: 0 });
    expect(options.find((o) => o.id === dg.id)).toMatchObject({ open: 1, sameArea: false });
  });

  it("sin permiso de Violencia de Género no cuenta esos expedientes", async () => {
    const vg = await createArea("Violencia de Género (prueba carga)");
    const prof = await prisma.user.create({ data: { email: "vg@prueba.test", name: "VG Prueba", role: "VIOLENCIA_GENERO", areaId: vg.id } });
    await prisma.case.create({ data: { title: "Reservado", areaId: vg.id, assignedToId: prof.id } });
    const sin = await getTeamWorkload({ areaId: vg.id, canViewSensitive: false });
    expect(sin!.totals.open).toBe(0);
    const con = await getTeamWorkload({ areaId: vg.id, canViewSensitive: true });
    expect(con!.totals.open).toBe(1);
    expect(await getTeamWorkload({ areaId: "no-existe", canViewSensitive: true })).toBeNull();
  });
});

describe("Recursos Humanos", () => {
  it("cuenta los ingresos del mes por fecha de ingreso y los sueldos sin los dados de baja", async () => {
    const area = await createArea("Área (prueba RR. HH.)");
    const { from } = currentMonthRange();
    const lastMonth = new Date(from.getTime() - 5 * 86_400_000);
    const agente = (dni: string, data: Record<string, unknown>) =>
      prisma.hRRecord.create({ data: { dni, firstName: "Agente", lastName: dni, areaId: area.id, ...data } as any });
    await agente("90000001", { startDate: from, salary: 100000 });
    await agente("90000002", { startDate: lastMonth, salary: 0 });
    await agente("90000003", { startDate: lastMonth, salary: 50000, status: "BAJA" });
    await agente("90000004", { salary: 0 });

    const stats = await getHRStats();
    expect(stats.total).toBe(4);
    expect(stats.inPayroll).toBe(3);
    expect(stats.newThisMonth).toBe(1);
    expect(stats.withSalary).toBe(1);
    expect(stats.totalBudget).toBe(100000);
    expect(stats.budgetByArea[area.id]).toBe(100000);
    expect(stats.staffByArea[area.id]).toBe(4);
  });
});
