import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
  abrirClaseAction, borrarClaseAction, deleteCursoAction, guardarAsistenciaAction, inscribirAction, marcarDejoAction, saveCursoAction,
  terminarCursoAction, volverAInscribirAction,
} from "@/app/(dashboard)/cursos/actions";
import { getClase, getCurso, getCursos, getCursosDePersona, getCursosDePrograma } from "@/services/cursos";
import { todayInArgentina, addDays } from "@/lib/follow-up-dates";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const errorOf = (r: { success: boolean; error?: string }) => (r.success ? null : r.error);
const PROGRAMA = "prog_centro_de_formacion_profesional_3f";
const hoy = todayInArgentina();

let formacion: { id: string };
let social: { id: string };
let docente: any;
let otraArea: any;
let auditor: any;
let dg: any;
let cursoId: string;

async function padron(dni: string, nombre: string, extra: Record<string, unknown> = {}) {
  await prisma.padronUnificado.create({ data: { dni, nombre_completo: nombre, telefono: "11 5555-0000", cantidad_programas: 0, ...extra } });
}

describe("cursos y talleres", () => {
  beforeAll(async () => {
    formacion = await createArea("Prueba Centro de Formación");
    social = await createArea("Prueba Social");
    docente = await createUser("OPERATIVO", formacion.id);
    otraArea = await createUser("OPERATIVO", social.id);
    auditor = await createUser("AUDITOR", formacion.id);
    dg = await createUser("DIRECCION_GENERAL");
    await padron("30111222", "Gómez, Ana");
    await padron("30111333", "Pérez, Luis");
    await padron("30111444", "Ruiz, Marta", { [PROGRAMA]: 1, cantidad_programas: 1, programas_activos: "Centro de Formación Profesional 3F" });
    await prisma.person.create({ data: { dni: "30111555", firstName: "Juan", lastName: "Sosa", phone: "11 4444-0000" } });
  });

  it("crea el curso en el área de quien lo carga (no en otra)", async () => {
    loginAs(auditor);
    expect(errorOf(await saveCursoAction(null, { nombre: "Electricidad", fechaInicio: hoy }))).toBe("Tu rol no puede crear cursos.");

    loginAs(docente);
    const res = await saveCursoAction(null, {
      nombre: "Electricidad domiciliaria", fechaInicio: addDays(hoy, -20), areaId: social.id, programa: PROGRAMA, cargaHoraria: "40", docente: "Prof. Prueba",
    });
    expect(res.success).toBe(true);
    cursoId = (res as any).id;
    const curso = await prisma.curso.findUniqueOrThrow({ where: { id: cursoId } });
    expect(curso.areaId).toBe(formacion.id);
    expect(curso.programa).toBe(PROGRAMA);
    expect(await prisma.auditLog.count({ where: { action: "CURSO_CREADO", entityId: cursoId } })).toBe(1);
  });

  it("no deja sumar cursos a un programa a cargo de otra área", async () => {
    await prisma.programaArea.create({ data: { programa: "prog_tarjeta_alimentar", areaId: social.id } });
    loginAs(docente);
    const res = await saveCursoAction(null, { nombre: "Cocina", fechaInicio: hoy, programa: "prog_tarjeta_alimentar" });
    expect(errorOf(res)).toMatch(/está a cargo de Prueba Social/);
  });

  it("inscribe y deja de alta en el programa del curso", async () => {
    loginAs(otraArea);
    expect(errorOf(await inscribirAction(cursoId, "30111222"))).toMatch(/conducción, quien creó el curso/);

    loginAs(docente);
    const res = await inscribirAction(cursoId, "30.111.222", addDays(hoy, -20));
    expect(res).toMatchObject({ success: true, nombre: "Gómez, Ana", altaPrograma: "Centro de Formación Profesional 3F" });
    const row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "30111222" } });
    expect((row as any)[PROGRAMA]).toBe(1);
    expect(row.cantidad_programas).toBe(1);
    const mov = await prisma.padronMovimiento.findFirstOrThrow({ where: { dni: "30111222", programa: PROGRAMA } });
    expect(mov).toMatchObject({ tipo: "ALTA", origen: "CURSO" });
    expect(mov.fecha.toISOString().slice(0, 10)).toBe(addDays(hoy, -20));

    // Ya estaba en el programa: no se da otra alta.
    expect(await inscribirAction(cursoId, "30111444", addDays(hoy, -20))).toMatchObject({ success: true, altaPrograma: null });
    expect(await prisma.padronMovimiento.count({ where: { dni: "30111444" } })).toBe(0);

    // Solo en el Registro Único: se lo suma al padrón.
    expect(await inscribirAction(cursoId, "30111555", addDays(hoy, -20))).toMatchObject({ success: true, nombre: "Sosa, Juan" });
    expect(await prisma.padronUnificado.findUnique({ where: { dni: "30111555" } })).not.toBeNull();

    expect(errorOf(await inscribirAction(cursoId, "30111222"))).toBe("Esa persona ya está inscripta en este curso.");
    expect(errorOf(await inscribirAction(cursoId, "99999999"))).toMatch(/no está en el padrón ni en el Registro Único/);
    expect(errorOf(await inscribirAction(cursoId, "30111333", addDays(hoy, 1)))).toBe("La inscripción no puede ser posterior a hoy.");
  });

  it("toma asistencia: quien no se marca queda ausente", async () => {
    loginAs(docente);
    expect(errorOf(await abrirClaseAction(cursoId, addDays(hoy, 1)))).toMatch(/no antes/);
    const a = await abrirClaseAction(cursoId, addDays(hoy, -14));
    const again = await abrirClaseAction(cursoId, addDays(hoy, -14));
    expect((again as any).id).toBe((a as any).id);
    const claseId = (a as any).id;

    const clase = await getClase(claseId);
    expect(clase!.lista.map((f) => f.nombre)).toEqual(["Gómez, Ana", "Ruiz, Marta", "Sosa, Juan"]);
    const [ana, marta] = clase!.lista;
    const res = await guardarAsistenciaAction(cursoId, claseId, { [ana.inscriptoId]: "PRESENTE", [marta.inscriptoId]: "AVISO", inventado: "PRESENTE" }, "Seguridad eléctrica");
    expect(res).toMatchObject({ success: true, presentes: 1, ausentes: 1, avisos: 1 });
    expect((await getClase(claseId))!.tema).toBe("Seguridad eléctrica");

    // Dos clases más: Ana viene a todas, Juan a una.
    for (const d of [-7, 0]) {
      const c = (await abrirClaseAction(cursoId, addDays(hoy, d))) as any;
      const l = (await getClase(c.id))!.lista;
      await guardarAsistenciaAction(cursoId, c.id, Object.fromEntries(l.map((f) => [f.inscriptoId, f.nombre === "Sosa, Juan" && d === 0 ? "AUSENTE" : "PRESENTE"])), "");
    }
    const curso = (await getCurso(cursoId))!;
    const by = Object.fromEntries(curso.inscriptos.map((i) => [i.nombre, i.asistencia]));
    expect(by["Gómez, Ana"]).toMatchObject({ presentes: 3, porcentaje: 100 });
    expect(by["Ruiz, Marta"]).toMatchObject({ presentes: 2, avisos: 1, porcentaje: 100 });
    expect(by["Sosa, Juan"]).toMatchObject({ presentes: 1, ausentes: 2, porcentaje: 33 });
    expect(curso.clases).toHaveLength(3);
  });

  it("anota que alguien dejó y, si se pide, lo da de baja del programa", async () => {
    loginAs(docente);
    await inscribirAction(cursoId, "30111333");
    const luis = (await getCurso(cursoId))!.inscriptos.find((i) => i.dni === "30111333")!;
    expect(errorOf(await marcarDejoAction(cursoId, luis.id, "", true))).toMatch(/Escribí por qué dejó/);
    expect(await marcarDejoAction(cursoId, luis.id, "Consiguió trabajo", true)).toMatchObject({ success: true, aviso: null });
    const row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "30111333" } });
    expect((row as any)[PROGRAMA]).toBe(0);
    expect(await prisma.padronMovimiento.findFirst({ where: { dni: "30111333", tipo: "BAJA" } })).toMatchObject({ motivo: "Dejó Electricidad domiciliaria: Consiguió trabajo" });
    // Ya no aparece en una clase nueva.
    const hoyClase = (await abrirClaseAction(cursoId, hoy)) as any;
    expect((await getClase(hoyClase.id))!.lista.some((f) => f.dni === "30111333")).toBe(false);

    expect((await volverAInscribirAction(cursoId, luis.id)).success).toBe(true);
    await marcarDejoAction(cursoId, luis.id, "No vino más", false);
  });

  it("al terminar salen los certificados y no se toca más la asistencia", async () => {
    loginAs(docente);
    expect((await terminarCursoAction(cursoId, true)).success).toBe(true);
    const curso = (await getCurso(cursoId))!;
    const cert = Object.fromEntries(curso.inscriptos.map((i) => [i.nombre, i.certificado]));
    expect(cert).toEqual({ "Gómez, Ana": true, "Pérez, Luis": false, "Ruiz, Marta": true, "Sosa, Juan": false });

    const clase = curso.clases[0];
    expect(errorOf(await guardarAsistenciaAction(cursoId, clase.id, {}, ""))).toMatch(/ya terminó/);
    expect(errorOf(await inscribirAction(cursoId, "30111333"))).toMatch(/ya terminó/);
    expect(errorOf(await borrarClaseAction(cursoId, clase.id))).toMatch(/ya terminó/);

    expect(await getCursosDePersona("30111222")).toMatchObject([{ nombre: "Electricidad domiciliaria", certificado: true, asistencia: 100 }]);
    expect(await getCursosDePrograma(PROGRAMA)).toMatchObject([{ id: cursoId, estado: "TERMINADO", inscriptos: 3 }]);
    expect((await getCursos({ estado: "TERMINADO" }))[0]).toMatchObject({ id: cursoId, inscriptos: 3, clases: 3 });
    expect(await getCursos({ estado: "ABIERTO" })).toHaveLength(0);
  });

  it("borra solo cursos sin clases, y lo hace quien lo creó o la conducción", async () => {
    loginAs(docente);
    expect(errorOf(await deleteCursoAction(cursoId))).toMatch(/dalo por terminado/);
    const nuevo = (await saveCursoAction(null, { nombre: "Taller de costura", tipo: "TALLER", fechaInicio: hoy })) as any;
    loginAs(otraArea);
    expect(errorOf(await deleteCursoAction(nuevo.id))).toBe("Lo borra quien lo creó o la conducción.");
    loginAs(dg);
    expect((await deleteCursoAction(nuevo.id)).success).toBe(true);
    expect(await prisma.curso.findUnique({ where: { id: nuevo.id } })).toBeNull();
  });
});
