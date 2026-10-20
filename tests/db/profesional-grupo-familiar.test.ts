import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/ficha-social/buscar/route";
import { assignCaseAction, createDerivationAction, respondDerivationAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { getAssignableUsers, countMyOpenCases } from "@/services/case-assignment";
import { getAllCases } from "@/services/cases";
import { getCaseEvents } from "@/services/case-timeline";
import { getCaseDerivations } from "@/services/derivations";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("profesional a cargo del expediente", () => {
  let social: Awaited<ReturnType<typeof createArea>>;
  let ninez: Awaited<ReturnType<typeof createArea>>;
  let vg: Awaited<ReturnType<typeof createArea>>;
  let director: Awaited<ReturnType<typeof createUser>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let colega: Awaited<ReturnType<typeof createUser>>;
  let otraArea: Awaited<ReturnType<typeof createUser>>;
  let directorNinez: Awaited<ReturnType<typeof createUser>>;
  let auditor: Awaited<ReturnType<typeof createUser>>;
  let violencia: Awaited<ReturnType<typeof createUser>>;
  let caseId: string;

  beforeAll(async () => {
    social = await createArea("Protección Social (prueba)");
    ninez = await createArea("Niñez (prueba)");
    vg = await createArea("Violencia de Género (prueba)");
    director = await createUser("DIRECTOR_AREA", social.id);
    operativo = await createUser("OPERATIVO", social.id);
    colega = await createUser("OPERATIVO", social.id);
    otraArea = await createUser("OPERATIVO", ninez.id);
    directorNinez = await createUser("DIRECTOR_AREA", ninez.id);
    auditor = await createUser("AUDITOR", social.id);
    violencia = await createUser("VIOLENCIA_GENERO", vg.id);
    const person = await prisma.person.create({ data: { dni: "93000001", firstName: "Titular", lastName: "Asignación" } });
    caseId = (await prisma.case.create({ data: { title: "Caso a asignar", personId: person.id, areaId: social.id } })).id;
  });

  it("solo ofrece personas del área (y la conducción) que pueden ver el expediente", async () => {
    const opciones = await getAssignableUsers({ areaId: social.id, areaName: social.name });
    const ids = opciones.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([director.id, operativo.id, colega.id]));
    expect(ids).not.toContain(otraArea.id);
    expect(ids).not.toContain(auditor.id);
  });

  it("alguien del área puede tomar un expediente sin profesional, pero no cambiar uno asignado", async () => {
    loginAs(operativo);
    expect((await assignCaseAction(caseId, operativo.id)).success).toBe(true);
    loginAs(colega);
    const res = await assignCaseAction(caseId, colega.id);
    expect(res.success).toBe(false);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).assignedToId).toBe(operativo.id);
  });

  it("quien dirige el área lo cambia, y a la persona nueva le llega un aviso", async () => {
    loginAs(director);
    expect((await assignCaseAction(caseId, colega.id)).success).toBe(true);
    const aviso = await prisma.notification.findFirst({ where: { userId: colega.id, link: `/cases/${caseId}` } });
    expect(aviso?.title).toBe("Te asignaron un expediente");
    expect(await countMyOpenCases(colega.id)).toBe(1);
    expect(await countMyOpenCases(operativo.id)).toBe(0);
  });

  it("no se puede dejar a cargo a alguien de otra área, a Auditoría, ni lo puede asignar el director de otra área", async () => {
    loginAs(director);
    expect((await assignCaseAction(caseId, otraArea.id)).success).toBe(false);
    expect((await assignCaseAction(caseId, auditor.id)).success).toBe(false);
    loginAs(directorNinez);
    expect((await assignCaseAction(caseId, directorNinez.id)).success).toBe(false);
  });

  it("un expediente de Violencia de Género solo puede quedar a cargo de quien puede verlo", async () => {
    const person = await prisma.person.create({ data: { dni: "93000002", firstName: "Titular", lastName: "Reservada" } });
    const vgCase = await prisma.case.create({ data: { title: "Caso reservado", personId: person.id, areaId: vg.id } });
    const opciones = await getAssignableUsers({ areaId: vg.id, areaName: vg.name });
    expect(opciones.map((o) => o.id)).toContain(violencia.id);
    loginAs(violencia);
    expect((await assignCaseAction(vgCase.id, violencia.id)).success).toBe(true);
  });

  it("'Mis expedientes' y 'Sin profesional' filtran la lista", async () => {
    const mine = await getAllCases({ assigned: "mine", userId: colega.id, canViewSensitive: false });
    expect(mine.cases.map((c) => c.id)).toEqual([caseId]);
    expect(mine.cases[0].assignedTo?.id).toBe(colega.id);
    const none = await getAllCases({ assigned: "none", canViewSensitive: false });
    expect(none.cases.map((c) => c.id)).not.toContain(caseId);
  });

  it("los cambios quedan en la historia del expediente", async () => {
    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    const events = await getCaseEvents({ id: caseId, createdAt: c.createdAt, areaName: social.name }, []);
    const asignaciones = events.filter((e) => e.kind === "ASIGNACION").map((e) => e.title);
    expect(asignaciones).toEqual([
      `Quedó a cargo de ${operativo.name}`,
      `Quedó a cargo de ${colega.name} (antes: ${operativo.name})`,
    ]);
  });

  it("si otra área acepta una derivación, el expediente queda sin profesional para que esa área elija", async () => {
    loginAs(director);
    expect((await createDerivationAction(caseId, ninez.id, "Corresponde a Niñez")).success).toBe(true);
    const [d] = await getCaseDerivations(caseId);
    loginAs(directorNinez);
    expect((await respondDerivationAction(d.id, true)).success).toBe(true);
    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.areaId).toBe(ninez.id);
    expect(c.assignedToId).toBeNull();
  });
});

const buscar = async (dni: string) => {
  const res = await GET(new Request(`http://localhost/api/ficha-social/buscar?dni=${encodeURIComponent(dni)}`));
  return (await res.json()) as any;
};

describe("grupo familiar en la Ficha 360°", () => {
  beforeAll(async () => {
    const social = await createArea("Desarrollo Humano (prueba familia)");
    const vg = await createArea("Violencia de Género (prueba familia)");
    const operativo = await createUser("OPERATIVO", social.id);
    loginAs(operativo);

    const padron = (dni: string, nombre: string, extra: Record<string, unknown> = {}) =>
      prisma.padronUnificado.create({ data: { dni, nombre_completo: nombre, localidad: "Tres de Febrero", ...extra } });

    await padron("94000001", "Madre Prueba", {
      direccion: "Calle Inventada  100",
      programas_activos: "Tarjeta Alimentar",
      nombres_familiares: "Hijo Prueba (Hijo); Sin Documento (Sobrina)",
      dnis_familiares: "94000002",
    });
    await padron("94000002", "Hijo Prueba", { direccion: "Otra Calle 5", fecha_nacimiento: "01/01/2016", programas_activos: "Jardines Municipales|Colonias" });
    await padron("94000003", "Abuela Prueba", { direccion: "calle inventada 100", edad_aprox: "70" });
    await padron("94000004", "Vecina Otra Localidad", { direccion: "Calle Inventada 100", localidad: "San Martín" });
    await padron("94000005", "Persona Sin Altura", { direccion: "Barrio Prueba", barrio: "Barrio Prueba" });
    await padron("94000006", "Otra Sin Altura", { direccion: "Barrio Prueba", barrio: "Barrio Prueba" });

    // Atención municipal de la abuela: un expediente social abierto con una intervención, y uno de VG.
    const abuela = await prisma.person.create({ data: { dni: "94000003", firstName: "Abuela", lastName: "Prueba" } });
    const caso = await prisma.case.create({ data: { title: "Acompañamiento", personId: abuela.id, areaId: social.id } });
    await prisma.intervention.create({ data: { caseId: caso.id, personId: abuela.id, userId: operativo.id, description: "Visita" } });
    const casoVg = await prisma.case.create({ data: { title: "Reservado", personId: abuela.id, areaId: vg.id } });
    await prisma.intervention.create({ data: { caseId: casoVg.id, personId: abuela.id, userId: operativo.id, description: "Reservada" } });
    const ficha = await prisma.stormVictimRecord.create({ data: { nombreApellido: "Abuela Prueba", dni: "94000003", domicilio: "Calle Inventada 100" } });
    await prisma.stormDelivery.create({ data: { recordId: ficha.id, colchones: 1, userName: "Depósito de prueba" } });
  });

  it("muestra los familiares cargados con sus datos del padrón y los convivientes de la misma localidad", async () => {
    const { grupo_familiar: g } = await buscar("94000001");
    expect(g.declarados).toEqual([
      expect.objectContaining({ dni: "94000002", nombre: "Hijo Prueba", vinculo: "Hijo", programas: ["Jardines Municipales", "Colonias"], enPadron: true }),
      expect.objectContaining({ dni: null, nombre: "Sin Documento", vinculo: "Sobrina", enPadron: false }),
    ]);
    expect(g.declarados[0].edad).toBeGreaterThanOrEqual(9);
    expect(g.mismoDomicilio.map((m: any) => m.dni)).toEqual(["94000003"]);
    expect(g.personasEnDomicilio).toBe(1);
    expect(g.mismoDomicilio[0]).toMatchObject({ vinculo: "Mismo domicilio", edad: 70 });
  });

  it("cuenta lo que la municipalidad hizo con cada familiar, sin los casos reservados si no tiene permiso", async () => {
    const { grupo_familiar: g } = await buscar("94000001");
    expect(g.mismoDomicilio[0].atencion).toEqual({ expedientes: 1, expedientesAbiertos: 1, intervenciones: 1, fichasTormenta: 1, entregas: 1 });
    expect(g.declarados[0].atencion).toEqual({ expedientes: 0, expedientesAbiertos: 0, intervenciones: 0, fichasTormenta: 0, entregas: 0 });
  });

  it("no busca convivientes si la dirección no tiene calle y altura", async () => {
    const { grupo_familiar: g } = await buscar("94000005");
    expect(g.sinDomicilio).toBe("SIN_ALTURA");
    expect(g.mismoDomicilio).toEqual([]);
  });
});
