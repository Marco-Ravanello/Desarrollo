import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { enrollInProgramAction, withdrawFromProgramAction } from "@/app/(dashboard)/people/actions/program-enrollment-actions";
import { setProgramAreaAction } from "@/app/(dashboard)/people/actions/program-area-actions";
import { getProgramEnrollment } from "@/services/program-enrollment";
import {
  getProgramDetail, getProgramOwners, getProgramPeople, getProgramPeopleForExport, getProgramSummaries, PROGRAM_PEOPLE_PAGE,
} from "@/services/programs";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const JM = "prog_jardines_municipales";
const TA = "prog_tarjeta_alimentar";
const errorOf = (r: { success: true } | { success: false; error: string }) => (r.success ? null : r.error);

describe("cada programa a cargo de un área", () => {
  it("solo la conducción elige el área, y queda en Auditoría", async () => {
    const ninez = await createArea("Prueba Niñez");
    const director = await createUser("DIRECTOR_AREA", ninez.id);
    const dg = await createUser("DIRECCION_GENERAL");

    loginAs(director as any);
    expect(errorOf(await setProgramAreaAction(JM, ninez.id))).toMatch(/conducción/);
    expect(await getProgramOwners()).toEqual(new Map());

    loginAs(dg as any);
    expect(errorOf(await setProgramAreaAction("prog_inventado", ninez.id))).toMatch(/programa/);
    expect(errorOf(await setProgramAreaAction(JM, "no-existe"))).toMatch(/área/);
    expect(await setProgramAreaAction(JM, ninez.id)).toEqual({ success: true });
    expect((await getProgramOwners()).get(JM)).toEqual({ areaId: ninez.id, areaName: "Prueba Niñez" });
    // Elegir la misma no anota nada nuevo.
    expect(await setProgramAreaAction(JM, ninez.id)).toEqual({ success: true });
    expect(await setProgramAreaAction(JM, null)).toEqual({ success: true });
    expect((await getProgramOwners()).has(JM)).toBe(false);

    const logs = await prisma.auditLog.findMany({ where: { action: "PROGRAMA_AREA" }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.details)).toEqual([
      "Jardines Municipales: a cargo de Prueba Niñez (antes: sin área).",
      "Jardines Municipales: sin área a cargo (antes: Prueba Niñez).",
    ]);
  });

  it("las altas y bajas de un programa con área las da esa área o la conducción", async () => {
    const ninez = await createArea("Prueba Niñez 2");
    const social = await createArea("Prueba Social");
    const deNinez = await createUser("OPERATIVO", ninez.id);
    const deSocial = await createUser("OPERATIVO", social.id);
    const sinArea = await createUser("OPERATIVO");
    const admin = await createUser("ADMIN_GENERAL");
    await prisma.programaArea.upsert({ where: { programa: JM }, create: { programa: JM, areaId: ninez.id }, update: { areaId: ninez.id } });
    await prisma.padronUnificado.create({ data: { dni: "97200001", nombre_completo: "Prueba, Lía" } });

    loginAs(deSocial as any);
    expect(errorOf(await enrollInProgramAction("97200001", JM, "2026-10-01"))).toMatch(/a cargo de Prueba Niñez 2/);
    loginAs(sinArea as any);
    expect(errorOf(await enrollInProgramAction("97200001", JM, "2026-10-01"))).toMatch(/a cargo de Prueba Niñez 2/);
    // Un programa sin área lo maneja cualquiera que carga datos, como antes.
    expect(await enrollInProgramAction("97200001", TA, "2026-10-01")).toEqual({ success: true });

    loginAs(deNinez as any);
    expect(await enrollInProgramAction("97200001", JM, "2026-10-02")).toEqual({ success: true });
    loginAs(deSocial as any);
    expect(errorOf(await withdrawFromProgramAction("97200001", JM, "2026-10-05", "Se mudó"))).toMatch(/a cargo de Prueba Niñez 2/);
    loginAs(admin as any);
    expect(await withdrawFromProgramAction("97200001", JM, "2026-10-05", "Se mudó")).toEqual({ success: true });

    // La ficha muestra los botones solo de los programas que maneja quien mira.
    const forSocial = await getProgramEnrollment("97200001", { role: "OPERATIVO", areaId: social.id });
    expect(forSocial.active.map((p) => [p.column, p.canManage])).toEqual([[TA, true]]);
    expect(forSocial.available.find((p) => p.column === JM)).toMatchObject({ canManage: false, areaName: "Prueba Niñez 2" });
    const forNinez = await getProgramEnrollment("97200001", { role: "OPERATIVO", areaId: ninez.id });
    expect(forNinez.available.find((p) => p.column === JM)?.canManage).toBe(true);
  });
});

describe("página de cada programa", () => {
  it("cuenta personas, barrios, altas y bajas por mes y motivos de baja, y lista de a 25", async () => {
    await prisma.programaArea.deleteMany();
    await prisma.padronMovimiento.deleteMany();
    await prisma.padronUnificado.deleteMany();
    const operativo = await createUser("OPERATIVO");
    const people = Array.from({ length: PROGRAM_PEOPLE_PAGE + 3 }, (_, i) => ({
      dni: String(97300000 + i),
      nombre_completo: `Prueba, Persona ${String(i).padStart(2, "0")}`,
      barrio: i < 20 ? "Barrio Uno" : i < 26 ? "Barrio Dos" : null,
      telefono: i % 2 === 0 ? "1100000000" : null,
      prog_jardines_municipales: 1,
    }));
    await prisma.padronUnificado.createMany({ data: [...people, { dni: "97399999", nombre_completo: "Prueba, Fuera", prog_tarjeta_alimentar: 1 }] });

    loginAs(operativo as any);
    expect(await withdrawFromProgramAction("97300000", JM, "2026-09-10", "Se mudó")).toEqual({ success: true });
    expect(await withdrawFromProgramAction("97300001", JM, "2026-10-03", "  se mudó ")).toEqual({ success: true });
    expect(await withdrawFromProgramAction("97300002", JM, "2026-10-04", "Terminó el ciclo")).toEqual({ success: true });
    expect(await enrollInProgramAction("97399999", JM, "2026-10-06")).toEqual({ success: true });

    const now = new Date("2026-10-26T15:00:00Z");
    const summaries = await getProgramSummaries(now);
    expect(summaries.find((s) => s.column === JM)).toMatchObject({ people: 26, owner: null, altas: 1, bajas: 2 });
    expect(summaries.find((s) => s.column === TA)?.people).toBe(1);

    const detail = await getProgramDetail(JM, now);
    expect(detail.people).toBe(26);
    expect(detail.months).toHaveLength(12);
    expect(detail.months[0].month).toBe("2025-11");
    expect(detail.months.at(-1)).toEqual({ month: "2026-10", altas: 1, bajas: 2 });
    expect(detail.months.at(-2)).toEqual({ month: "2026-09", altas: 0, bajas: 1 });
    expect([detail.altas12, detail.bajas12]).toEqual([1, 3]);
    // "Se mudó" y " se mudó " son el mismo motivo; se muestra como se escribió la última vez.
    expect(detail.reasons).toEqual([
      { motivo: "se mudó", total: 2 },
      { motivo: "Terminó el ciclo", total: 1 },
    ]);
    expect(detail.barrios[0]).toEqual({ barrio: "Barrio Uno", total: 17 });
    expect(detail.barrioCount).toBe(2);

    const page1 = await getProgramPeople(JM);
    expect([page1.total, page1.pages, page1.people.length]).toEqual([26, 2, 25]);
    expect(page1.people[0].nombre).toBe("Prueba, Fuera");
    expect(page1.people[0].desde?.slice(0, 10)).toBe("2026-10-06");
    expect(page1.people[1].desde).toBeNull();
    const page2 = await getProgramPeople(JM, { page: 9 });
    expect([page2.page, page2.people.length]).toEqual([2, 1]);
    expect((await getProgramPeople(JM, { q: "9730002" })).people.map((p) => p.dni)).toEqual(Array.from({ length: 8 }, (_, i) => String(97300020 + i)));
    expect((await getProgramPeople(JM, { q: "barrio dos" })).total).toBe(6);
    expect((await getProgramPeople(JM, { q: "nadie así" })).total).toBe(0);

    const exported = await getProgramPeopleForExport(JM);
    expect(exported).toHaveLength(26);
  });
});
