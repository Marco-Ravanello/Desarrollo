import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { deleteLugarAction, saveLugarAction } from "@/app/(dashboard)/barrios/actions";
import { getBarrioDetail, getBarrioPeople, getBarrioSummaries } from "@/services/barrios";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const errorOf = (r: { success: true } | { success: false; error: string }) => (r.success ? null : r.error);
const all = { canViewSensitive: true };
const noVg = { canViewSensitive: false };

describe("página de cada barrio", () => {
  beforeAll(async () => {
    await prisma.padronUnificado.createMany({
      data: [
        { dni: "97300001", nombre_completo: "Barrio, Ana", barrio: "Barrio Evita", localidad: "Ciudadela", telefono: "11 5555-0001", cantidad_programas: 1, prog_tarjeta_alimentar: 1 },
        { dni: "97300002", nombre_completo: "Barrio, Beto", barrio: "evita", localidad: "Ciudadela", cantidad_programas: 2, prog_tarjeta_alimentar: 1, prog_centro_de_familia: 1 },
        // Sin barrio de la lista: cuenta por la localidad.
        { dni: "97300003", nombre_completo: "Barrio, Ceci", barrio: "El Palomar", localidad: "Caseros", direccion: "Calle Inventada 10" },
        { dni: "97300004", nombre_completo: "Barrio, Dani", barrio: "Fuerte Apache", localidad: "Ciudadela" },
        { dni: "97300005", nombre_completo: "Barrio, Eli", barrio: "El Palomar", localidad: "Tres de Febrero" },
        { dni: "97300006", nombre_completo: "Barrio, Fede" },
      ],
    });
    const social = await createArea("Prueba Social");
    const vg = await createArea("Prueba Violencia de Género");
    const ana = await prisma.person.create({ data: { dni: "97300001", firstName: "Ana", lastName: "Barrio" } });
    const beto = await prisma.person.create({ data: { dni: "97300002", firstName: "Beto", lastName: "Barrio" } });
    await prisma.case.createMany({
      data: [
        { personId: ana.id, areaId: social.id, title: "Caso Ana", priority: "MEDIA", labels: ["ADULTO_MAYOR", "DISCAPACIDAD"] },
        { personId: beto.id, areaId: social.id, title: "Caso Beto", priority: "URGENTE" },
        { personId: beto.id, areaId: social.id, title: "Caso cerrado", status: "CERRADO" },
        { personId: ana.id, areaId: vg.id, title: "Caso reservado", priority: "ALTA" },
      ],
    });
    const record = await prisma.stormVictimRecord.create({
      data: { nombreApellido: "Barrio, Ana", dni: "97300001", domicilio: "Calle 1", barrio: "Evita" },
    });
    await prisma.stormVictimRecord.create({ data: { nombreApellido: "Otra", domicilio: "Calle 2", barrio: "Evita / Mercado" } });
    await prisma.stormDelivery.create({ data: { recordId: record.id, colchones: 2, frazadas: 3, userName: "Depósito de prueba" } });
  });

  it("la lista suma cada barrio por su nombre, sus otras formas y la localidad", async () => {
    const data = await getBarrioSummaries(all);
    const evita = data.barrios.find((b) => b.barrio === "Evita")!;
    expect(evita).toMatchObject({ slug: "evita", people: 2, withPrograms: 2, openCases: 3, stormRecords: 1, lugares: 0 });
    expect(data.barrios.find((b) => b.barrio === "Caseros")!.people).toBe(1);
    expect(data.barrios.find((b) => b.barrio === "Ejército de los Andes")!.people).toBe(1);
    expect(data.totalPeople).toBe(6);
    expect(data.withoutBarrio).toBe(2);
    expect(data.blank).toBe(1);
    expect(data.unmatched).toEqual([{ value: "El Palomar", total: 1 }]);
    // Sin permiso, los de Violencia de Género no se cuentan.
    expect((await getBarrioSummaries(noVg)).barrios.find((b) => b.barrio === "Evita")!.openCases).toBe(2);
  });

  it("el barrio muestra programas, expedientes por etiqueta y área, y la emergencia", async () => {
    const d = await getBarrioDetail("Evita", noVg);
    expect(d).toMatchObject({ people: 2, withPrograms: 2, withPhone: 1, openCases: 2 });
    expect(d.programs.map((p) => [p.label, p.total])).toEqual([["Tarjeta Alimentar", 2], ["Centro de Familia", 1]]);
    expect(d.casesByLabel).toEqual([
      { label: "ADULTO_MAYOR", total: 1 },
      { label: "DISCAPACIDAD", total: 1 },
      { label: null, total: 1 },
    ]);
    expect(d.casesByArea.map((a) => [a.areaName, a.total])).toEqual([["Prueba Social", 2]]);
    expect(d.cases.map((c) => c.title)).toEqual(["Caso Beto", "Caso Ana"]);
    expect(d.cases[0].titular).toBe("Barrio, Beto");
    expect(d.storm).toMatchObject({ records: 1, deliveries: 1, colchones: 2, frazadas: 3 });

    const conVg = await getBarrioDetail("Evita", all);
    expect(conVg.cases.map((c) => c.title)).toEqual(["Caso Beto", "Caso reservado", "Caso Ana"]);
    expect((await getBarrioDetail("Villa Raffo", all)).people).toBe(0);
  });

  it("lista las personas del barrio y busca por nombre, calle o DNI", async () => {
    const list = await getBarrioPeople("Evita");
    expect(list.people.map((p) => p.dni)).toEqual(["97300001", "97300002"]);
    expect(list.people[1].programas).toBe(2);
    expect((await getBarrioPeople("Evita", { q: "beto" })).people.map((p) => p.dni)).toEqual(["97300002"]);
    expect((await getBarrioPeople("Evita", { q: "97.300.001" })).total).toBe(1);
    expect((await getBarrioPeople("Caseros", { q: "inventada" })).people.map((p) => p.dni)).toEqual(["97300003"]);
    expect((await getBarrioPeople("Caseros", { page: 9 })).page).toBe(1);
  });
});

describe("lugares de referencia de un barrio", () => {
  it("los carga y corrige el equipo, los borra quien los cargó o la conducción, y queda en Auditoría", async () => {
    const area = await createArea("Prueba Lugares");
    const operativo = await createUser("OPERATIVO", area.id);
    const otro = await createUser("OPERATIVO", area.id);
    const auditor = await createUser("AUDITOR");
    const dg = await createUser("DIRECCION_GENERAL");
    const form = { tipo: "ESCUELA", nombre: "Escuela de Prueba N° 1", telefono: "4750-0000", contacto: "Directora" };

    loginAs(auditor as any);
    expect(errorOf(await saveLugarAction("Evita", null, form))).toMatch(/no puede/);
    loginAs(operativo as any);
    expect(errorOf(await saveLugarAction("El Palomar", null, form))).toMatch(/barrio/);
    expect(errorOf(await saveLugarAction("Evita", null, { ...form, nombre: "" }))).toMatch(/nombre/);
    expect(await saveLugarAction("Evita", null, form)).toEqual({ success: true });
    const lugar = await prisma.lugarReferencia.findFirstOrThrow();
    expect(lugar).toMatchObject({ barrio: "Evita", tipo: "ESCUELA", createdById: operativo.id, direccion: null });

    loginAs(otro as any);
    expect(await saveLugarAction("Evita", lugar.id, { ...form, telefono: "4750-1111", horario: "De 8 a 12" })).toEqual({ success: true });
    expect(await prisma.lugarReferencia.findUniqueOrThrow({ where: { id: lugar.id } })).toMatchObject({ telefono: "4750-1111", horario: "De 8 a 12", updatedById: otro.id });
    expect(errorOf(await deleteLugarAction("Evita", lugar.id))).toMatch(/quien lo cargó/);

    expect((await getBarrioSummaries(all)).barrios.find((b) => b.barrio === "Evita")!.lugares).toBe(1);
    expect((await getBarrioDetail("Evita", all)).lugares.map((l) => l.nombre)).toEqual(["Escuela de Prueba N° 1"]);

    loginAs(dg as any);
    expect(await deleteLugarAction("Evita", lugar.id)).toEqual({ success: true });
    expect(await prisma.lugarReferencia.count()).toBe(0);

    const logs = await prisma.auditLog.findMany({ where: { entity: "LugarReferencia" }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => [l.action, l.details])).toEqual([
      ["LUGAR_CREADO", "Escuela “Escuela de Prueba N° 1” en Evita."],
      ["LUGAR_EDITADO", "“Escuela de Prueba N° 1” en Evita: cambió teléfono, horario."],
      ["LUGAR_BORRADO", "Escuela “Escuela de Prueba N° 1” en Evita."],
    ]);
  });
});
