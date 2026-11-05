import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
  mergePeopleAction,
  previewMergeAction,
  searchMergeCandidatesAction,
} from "@/app/(dashboard)/people/actions/padron-duplicates-actions";
import { findMergedInto, getMergeSide } from "@/services/person-merge";
import { getPersonDataChanges } from "@/services/person-data";
import { createArea, createUser, loginAs } from "./helpers";

// Personas, cursos, recorridas y convenios inventados, solo en la base de prueba local que se vacía en cada archivo.

const day = (d: string) => new Date(`${d}T00:00:00Z`);

let seeded: ReturnType<typeof doSeed> | null = null;
const seed = () => (seeded ??= doSeed());

async function doSeed() {
  const area = await createArea("Dirección de Niñez (prueba)");
  const admin = await createUser("DIRECCION_GENERAL");
  const director = await createUser("DIRECTOR_AREA", area.id);

  // La misma persona: una ficha con DNI real en el padrón y otra cargada "Sin DNI" solo en el Registro Único.
  await prisma.padronUnificado.create({
    data: { dni: "93000001", nombre_completo: "Pérez, Marta Prueba", direccion: "Calle Inventada 10", programas_activos: "Centro de Familia", prog_centro_de_familia: 1, cantidad_programas: 1 } as any,
  });
  const real = await prisma.person.create({ data: { dni: "93000001", firstName: "Marta Prueba", lastName: "Pérez" } });
  const temp = await prisma.person.create({ data: { dni: "TEMP-777", firstName: "Marta", lastName: "Pérez", phone: "11 5004-1004" } });
  const caso = await prisma.case.create({ data: { title: "Expediente sin DNI", personId: temp.id, areaId: area.id } });
  await prisma.intervention.create({ data: { caseId: caso.id, personId: temp.id, userId: admin.id, description: "Visita inventada", date: day("2026-10-01") } });

  // Un familiar en el padrón que la tiene anotada con el DNI provisorio.
  await prisma.padronUnificado.create({ data: { dni: "93000002", nombre_completo: "Pérez, Hijo Prueba", dnis_familiares: "TEMP-777, 93000099" } as any });

  // Anotada en el mismo curso con las dos fichas, cada una con asistencia a una clase distinta.
  const curso = await prisma.curso.create({ data: { nombre: "Curso inventado", fechaInicio: day("2026-10-01") } as any });
  const c1 = await prisma.cursoClase.create({ data: { cursoId: curso.id, fecha: day("2026-10-02") } as any });
  const c2 = await prisma.cursoClase.create({ data: { cursoId: curso.id, fecha: day("2026-10-09") } as any });
  const insReal = await prisma.cursoInscripto.create({ data: { cursoId: curso.id, dni: "93000001", fecha: day("2026-10-01") } });
  const insTemp = await prisma.cursoInscripto.create({ data: { cursoId: curso.id, dni: "TEMP-777", fecha: day("2026-10-01") } });
  await prisma.cursoAsistencia.create({ data: { claseId: c1.id, inscriptoId: insReal.id, estado: "PRESENTE" } });
  await prisma.cursoAsistencia.create({ data: { claseId: c2.id, inscriptoId: insTemp.id, estado: "PRESENTE" } });

  // En la misma recorrida con las dos: la del DNI provisorio ya fue visitada.
  const rec = await prisma.recorrida.create({ data: { barrio: "Caseros", fecha: day("2026-10-20") } });
  await prisma.recorridaVisita.create({ data: { recorridaId: rec.id, dni: "93000001" } });
  await prisma.recorridaVisita.create({ data: { recorridaId: rec.id, dni: "TEMP-777", resultado: "VISITADA" } });

  // En un convenio solo con el DNI provisorio, y un alta de programa.
  const conv = await prisma.agreement.create({ data: { title: "Convenio inventado" } });
  await prisma.convenioNnya.create({ data: { agreementId: conv.id, dni: "TEMP-777", nombre: "Marta" } });
  await prisma.padronMovimiento.create({ data: { dni: "TEMP-777", programa: "Tarjeta Alimentar", tipo: "ALTA", fecha: day("2026-10-05") } as any });

  return { admin, director, real, temp, curso, rec, conv, c2 };
}

describe("unir dos fichas de la misma persona", () => {
  it("solo la conducción puede buscar, comparar y unir", async () => {
    const { director } = await seed();
    loginAs(director);
    expect(await searchMergeCandidatesAction("93000001", "")).toEqual([]);
    expect(await previewMergeAction("93000001", "TEMP-777")).toMatchObject({ success: false });
    expect(await mergePeopleAction("93000001", "TEMP-777")).toMatchObject({ success: false });
    expect(await prisma.person.count({ where: { dni: "TEMP-777" } })).toBe(1);
  });

  it("sugiere la ficha con el mismo nombre y compara las dos", async () => {
    const { admin } = await seed();
    loginAs(admin);
    const found = await searchMergeCandidatesAction("93000001", "");
    expect(found).toEqual([expect.objectContaining({ dni: "TEMP-777", sugerida: true })]);
    expect((await searchMergeCandidatesAction("93000001", "TEMP"))[0]?.dni).toBe("TEMP-777");
    const prev = await previewMergeAction("93000001", "TEMP-777");
    expect(prev).toMatchObject({ success: true, b: { dni: "TEMP-777", enPadron: false, expedientes: 1, intervenciones: 1, cursos: 1, visitas: 1, convenios: 1 } });
    expect(await previewMergeAction("93000001", "93000001")).toMatchObject({ success: false });
  });

  it("pasa todo a la ficha que queda y la otra desaparece", async () => {
    const { admin, real, curso, rec, conv, c2 } = await seed();
    loginAs(admin);
    expect(await mergePeopleAction("93000001", "TEMP-777")).toEqual({ success: true, keepDni: "93000001" });

    expect(await getMergeSide("TEMP-777")).toBeNull();
    const kept = await prisma.person.findUniqueOrThrow({ where: { id: real.id }, include: { cases: true, interventions: true } });
    expect(kept.phone).toBe("11 5004-1004"); // se completa lo vacío
    expect(kept.firstName).toBe("Marta Prueba"); // no se pisa
    expect(kept.cases.map((c) => c.title)).toEqual(["Expediente sin DNI"]);
    expect(kept.interventions).toHaveLength(1);

    // Curso: una sola inscripción, con las asistencias de las dos.
    const ins = await prisma.cursoInscripto.findMany({ where: { cursoId: curso.id }, include: { asistencias: true } });
    expect(ins).toHaveLength(1);
    expect(ins[0].dni).toBe("93000001");
    expect(ins[0].asistencias.map((a) => a.claseId)).toContain(c2.id);
    expect(ins[0].asistencias).toHaveLength(2);

    // Recorrida: queda la visita que tenía resultado, con el DNI que queda.
    const visitas = await prisma.recorridaVisita.findMany({ where: { recorridaId: rec.id } });
    expect(visitas).toEqual([expect.objectContaining({ dni: "93000001", resultado: "VISITADA" })]);

    expect(await prisma.convenioNnya.findFirstOrThrow({ where: { agreementId: conv.id } })).toMatchObject({ dni: "93000001" });
    expect(await prisma.padronMovimiento.count({ where: { dni: "93000001" } })).toBe(1);
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "93000002" } })).dnis_familiares).toBe("93000001, 93000099");

    // Queda en la Historia de la que queda y la dirección vieja lleva a la nueva.
    const cambios = await getPersonDataChanges("93000001");
    expect(cambios[0].cambios.join(" ")).toContain("Se unió con la ficha del DNI TEMP-777");
    expect(cambios[0].cambios.join(" ")).toContain("1 expediente");
    expect(await findMergedInto("TEMP-777")).toBe("93000001");
    expect(await findMergedInto("93000001")).toBeNull();
  });

  it("si la ficha que queda no estaba en el padrón ni en el Registro, toma el registro de la otra", async () => {
    const { admin } = await seed();
    await prisma.padronUnificado.create({ data: { dni: "93000010", nombre_completo: "Solo Padrón Prueba" } as any });
    await prisma.person.create({ data: { id: "93000011", dni: "93000011", firstName: "Solo", lastName: "Registro" } });
    loginAs(admin);
    // Queda el DNI del Registro Único; el registro del padrón pasa a ese DNI.
    expect(await mergePeopleAction("93000011", "93000010")).toMatchObject({ success: true });
    expect(await prisma.padronUnificado.findUnique({ where: { dni: "93000011" } })).toMatchObject({ nombre_completo: "Solo Padrón Prueba" });
    expect(await prisma.padronUnificado.findUnique({ where: { dni: "93000010" } })).toBeNull();

    // Al revés: queda un DNI que solo está en el padrón y la persona del Registro cambia de DNI (y de id).
    await prisma.padronUnificado.create({ data: { dni: "93000020", nombre_completo: "Otra Prueba" } as any });
    const p = await prisma.person.create({ data: { id: "93000021", dni: "93000021", firstName: "Otra", lastName: "Prueba" } });
    const area = await prisma.area.findFirstOrThrow();
    await prisma.case.create({ data: { title: "Caso que la sigue", personId: p.id, areaId: area.id } });
    expect(await mergePeopleAction("93000020", "93000021")).toMatchObject({ success: true });
    const moved = await prisma.person.findUniqueOrThrow({ where: { dni: "93000020" }, include: { cases: true } });
    expect(moved.id).toBe("93000020");
    expect(moved.cases.map((c) => c.title)).toEqual(["Caso que la sigue"]);
  });
});
