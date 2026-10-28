import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { enrollCandidateAction, saveProgramRequirementsAction } from "@/app/(dashboard)/people/actions/program-requirements-actions";
import { markBackFromLeaveAction } from "@/app/(dashboard)/admin/actions/hr-actions";
import { countProgramCandidates, getProgramCandidates, getProgramRequirements } from "@/services/program-requirements";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const JM = "prog_jardines_municipales";
const TA = "prog_tarjeta_alimentar";
const CF = "prog_centro_de_familia";
const errorOf = (r: { success: true } | { success: false; error: string }) => (r.success ? null : r.error);
const NOW = new Date("2026-10-28T15:00:00Z");
const ALL = { canViewSensitive: true };
const NO_VG = { canViewSensitive: false };

async function padron(dni: string, data: Record<string, unknown> = {}) {
  return prisma.padronUnificado.create({ data: { dni, nombre_completo: `Prueba, ${dni}`, ...data } as any });
}
const dnis = (list: { dni: string }[]) => list.map((p) => p.dni).sort();

describe("requisitos de un programa", () => {
  it("los cambia quien da altas en el programa y queda en Auditoría", async () => {
    const ninez = await createArea("Prueba Niñez requisitos");
    const otra = await createArea("Prueba Otra requisitos");
    const deOtra = await createUser("OPERATIVO", otra.id);
    const deNinez = await createUser("OPERATIVO", ninez.id);
    await prisma.programaArea.create({ data: { programa: JM, areaId: ninez.id } });

    loginAs(deOtra as any);
    expect(errorOf(await saveProgramRequirementsAction(JM, { edadMax: "4" }))).toMatch(/a cargo de Prueba Niñez requisitos/);
    loginAs(deNinez as any);
    expect(errorOf(await saveProgramRequirementsAction("prog_inventado", { edadMax: "4" }))).toMatch(/programa/);
    expect(errorOf(await saveProgramRequirementsAction(JM, { edadMin: "5", edadMax: "4" }))).toMatch(/mínima/);
    expect(await saveProgramRequirementsAction(JM, { edadMin: "1", edadMax: "4", barrios: ["Caseros"], nota: "Con DNI al día" })).toEqual({ success: true });

    expect(await getProgramRequirements(JM)).toMatchObject({ edadMin: 1, edadMax: 4, barrios: ["Caseros"], nota: "Con DNI al día" });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "PROGRAMA_REQUISITOS" } });
    expect(log.details).toBe("Requisitos de Jardines Municipales: De 1 a 4 años. Vive en Caseros. Otros: Con DNI al día.");
  });

  it("la lista trae a quienes cumplen y no están, con la edad de cualquier fecha cargada", async () => {
    // Edades al 28/10/2026.
    await padron("97300001", { fecha_nacimiento: "15/03/2023" }); // 3 años
    await padron("97300002", { fecha_nacimiento: "2022-11-30" }); // 3 años (cumple 4 en noviembre)
    await padron("97300003", { fecha_nacimiento: "28/10/2022" }); // cumple 4 hoy
    await padron("97300004", { fecha_nacimiento: "01/01/2020" }); // 6 años: afuera
    await padron("97300005", { edad_aprox: "2 años" }); // edad aproximada
    await padron("97300006", { fecha_nacimiento: "31/02/2023" }); // fecha rara: no rompe la consulta
    await padron("97300007"); // sin edad
    await prisma.person.create({ data: { dni: "97300008", firstName: "Del", lastName: "Registro", birthDate: new Date("2024-05-10T12:00:00Z") } });
    await padron("97300008"); // la fecha está en el Registro Único: 2 años
    await padron("97300009", { fecha_nacimiento: "10/10/2023", [JM]: 1 }); // ya está en el programa
    await prisma.padronMovimiento.create({ data: { dni: "97300001", programa: JM, tipo: "BAJA", fecha: new Date("2026-03-01T00:00:00Z"), motivo: "Se mudó", origen: "APP" } });

    const r = await getProgramRequirements(JM);
    const req = { ...r, edadMin: 1, edadMax: 4, barrios: [] as any[], nota: null };
    const list = await getProgramCandidates(JM, req, ALL, {}, NOW);
    expect(dnis(list.people)).toEqual(["97300001", "97300002", "97300003", "97300005", "97300006", "97300008"]);
    const byDni = new Map(list.people.map((p) => [p.dni, p]));
    expect(byDni.get("97300001")).toMatchObject({ edad: 3, ultimaBaja: "2026-03-01" });
    expect(byDni.get("97300002")!.edad).toBe(3);
    expect(byDni.get("97300003")!.edad).toBe(4);
    expect(byDni.get("97300005")!.edad).toBe(2);
    expect(byDni.get("97300008")!.edad).toBe(2);
    expect(await countProgramCandidates(JM, req, ALL, NOW)).toEqual({ total: 6, withoutAge: 1 });

    // Búsqueda dentro de la lista.
    expect(dnis((await getProgramCandidates(JM, req, ALL, { q: "973000 05" }, NOW)).people)).toEqual(["97300005"]);
  });

  it("filtra por barrio, otros programas y etiquetas de expedientes abiertos (Violencia de Género solo con permiso)", async () => {
    await padron("97400001", { barrio: "Villa Bosch", [TA]: 1 });
    await padron("97400002", { barrio: "villa bosch", [TA]: 1, [CF]: 1 }); // excluida por Centro de Familia
    await padron("97400003", { localidad: "Villa Bosch", [TA]: 1 }); // el barrio viene en la localidad
    await padron("97400004", { barrio: "Caseros", [TA]: 1 }); // otro barrio
    await padron("97400005", { barrio: "Villa Bosch" }); // no está en Tarjeta Alimentar

    const base = { edadMin: null, edadMax: null, etiquetas: [] as any[], nota: null };
    const req = { ...base, barrios: ["Villa Bosch"] as any[], enProgramas: [TA] as any[], sinProgramas: [CF] as any[] };
    expect(dnis((await getProgramCandidates(JM, req, ALL, {}, NOW)).people)).toEqual(["97400001", "97400003"]);
    expect(await countProgramCandidates(JM, req, ALL, NOW)).toEqual({ total: 2, withoutAge: 0 });

    const social = await createArea("Prueba Social destinatarios");
    const vg = await createArea("Violencia de Género (prueba destinatarios)");
    const p1 = await prisma.person.create({ data: { dni: "97400001", firstName: "Uno", lastName: "Prueba" } });
    const p3 = await prisma.person.create({ data: { dni: "97400003", firstName: "Tres", lastName: "Prueba" } });
    const p4 = await prisma.person.create({ data: { dni: "97400004", firstName: "Cuatro", lastName: "Prueba" } });
    await prisma.case.create({ data: { title: "Abierto", areaId: social.id, personId: p1.id, labels: ["DISCAPACIDAD"] } });
    await prisma.case.create({ data: { title: "Cerrado", areaId: social.id, personId: p4.id, labels: ["DISCAPACIDAD"], status: "CERRADO" } });
    await prisma.case.create({ data: { title: "VG", areaId: vg.id, personId: p3.id, labels: ["DISCAPACIDAD"] } });

    const byLabel = { ...base, barrios: [] as any[], enProgramas: [] as any[], sinProgramas: [] as any[], etiquetas: ["DISCAPACIDAD"] as any[] };
    expect(dnis((await getProgramCandidates(JM, byLabel, ALL, {}, NOW)).people)).toEqual(["97400001", "97400003"]);
    expect(dnis((await getProgramCandidates(JM, byLabel, NO_VG, {}, NOW)).people)).toEqual(["97400001"]);
  });

  it("sin requisitos que se puedan revisar no arma lista", async () => {
    const req = { edadMin: null, edadMax: null, barrios: [], etiquetas: [], enProgramas: [], sinProgramas: [], nota: "Solo una nota" };
    expect(await countProgramCandidates(JM, req, ALL, NOW)).toEqual({ total: 0, withoutAge: 0 });
    expect((await getProgramCandidates(JM, req, ALL, {}, NOW)).people).toEqual([]);
  });

  it("el alta con un toque queda como cualquier alta, con la fecha de hoy", async () => {
    const admin = await createUser("ADMIN_GENERAL");
    const auditor = await createUser("AUDITOR");
    await padron("97500001", { barrio: "Caseros" });

    loginAs(auditor as any);
    expect((await enrollCandidateAction("97500001", CF)).success).toBe(false);
    loginAs(admin as any);
    expect(await enrollCandidateAction("97500001", CF)).toEqual({ success: true });
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97500001" } }))[CF]).toBe(1);
    const mov = await prisma.padronMovimiento.findFirstOrThrow({ where: { dni: "97500001", programa: CF } });
    expect(mov).toMatchObject({ tipo: "ALTA", origen: "APP", motivo: "Desde la lista de posibles destinatarios." });
    expect(errorOf(await enrollCandidateAction("97500001", CF))).toMatch(/Ya está/);
  });
});

describe("Ya volvió de la licencia", () => {
  it("pasa a Activo sin fecha, solo Superadmin y Administración General, y queda en Auditoría", async () => {
    const dg = await createUser("DIRECCION_GENERAL");
    const admin = await createUser("ADMIN_GENERAL");
    const base = { contractType: "MENSUALIZADO" as const };
    const lic = await prisma.hRRecord.create({ data: { ...base, dni: "90100001", firstName: "Ana", lastName: "Licencia", status: "LICENCIA", statusUntil: new Date("2026-10-30T00:00:00Z") } });
    const act = await prisma.hRRecord.create({ data: { ...base, dni: "90100002", firstName: "Beto", lastName: "Activo", status: "ACTIVO" } });

    loginAs(dg as any);
    expect(errorOf(await markBackFromLeaveAction(lic.id))).toMatch(/Superadmin y Administración General/);
    loginAs(admin as any);
    expect(errorOf(await markBackFromLeaveAction(act.id))).toMatch(/ya no figura de licencia/);
    expect(await markBackFromLeaveAction(lic.id)).toEqual({ success: true });
    expect(await prisma.hRRecord.findUniqueOrThrow({ where: { id: lic.id } })).toMatchObject({ status: "ACTIVO", statusUntil: null });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "HR_VOLVIO" } });
    expect(log.details).toBe("Licencia, Ana volvió de la licencia: pasa a Activo.");
  });
});
