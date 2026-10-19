import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
  completeStormRecordDniAction,
  lookupStormDniAction,
  saveStormVictimAction,
} from "@/app/(dashboard)/admin/actions/emergency-actions";
import { getEmergencyOperationsData } from "@/services/emergency";
import { recordsWithoutDni } from "@/lib/emergency-categories";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
const ficha = {
  nombreApellido: "Vecina Tormenta",
  domicilio: "Calle de Prueba 456",
  barrio: "Barrio de prueba",
  contacto: "1155550000",
  edad: "40",
  requiereFrazada: true,
  cantidadFrazada: 3,
  prioridad: "MEDIA" as const,
};

const tempPeople = () => prisma.person.count({ where: { dni: { startsWith: "TEMP-" } } });

describe("fichas de tormenta y padrón", () => {
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let relevador1: Awaited<ReturnType<typeof createUser>>;
  let relevador2: Awaited<ReturnType<typeof createUser>>;
  let auditor: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    const area = await createArea("Desarrollo Humano (prueba)");
    operativo = await createUser("OPERATIVO", area.id);
    relevador1 = await createUser("RELEVADOR_EMERGENCIA", area.id);
    relevador2 = await createUser("RELEVADOR_EMERGENCIA", area.id);
    auditor = await createUser("AUDITOR");
    // Persona que ya estaba en el padrón, en otro programa.
    await prisma.padronUnificado.create({
      data: {
        dni: "91000002",
        nombre_completo: "Persona Del Padrón",
        direccion: "Dirección original 1",
        cantidad_programas: 1,
        programas_activos: "Centro de Familia",
        prog_centro_de_familia: 1,
      },
    });
  });

  it("si la persona no está en el padrón, se suma con los datos de la ficha y el programa Emergencia climática", async () => {
    loginAs(operativo);
    const res = await saveStormVictimAction({ ...ficha, dni: "91.000.001" });
    expect(res.success).toBe(true);

    const padron = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "91000001" } });
    expect(padron).toMatchObject({
      nombre_completo: "Vecina Tormenta",
      direccion: "Calle de Prueba 456",
      barrio: "Barrio de prueba",
      telefono: "1155550000",
      edad_aprox: "40",
      cantidad_programas: 1,
      programas_activos: "Emergencia climática",
      prog_emergencia_climatica: 1,
    });
    expect(await prisma.participacionPrograma.count({ where: { dni: "91000001", programa: "Emergencia climática" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "PADRON_ALTA_EMERGENCIA", entityId: "91000001" } })).toBe(1);
  });

  it("si ya está en el padrón, no se tocan sus datos y se suma al programa una sola vez", async () => {
    loginAs(operativo);
    await saveStormVictimAction({ ...ficha, dni: "91000002" });
    await saveStormVictimAction({ ...ficha, dni: "91000002", domicilio: "Otra calle 789" });

    const padron = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "91000002" } });
    expect(padron).toMatchObject({
      nombre_completo: "Persona Del Padrón",
      direccion: "Dirección original 1",
      cantidad_programas: 2,
      programas_activos: "Centro de Familia | Emergencia climática",
      prog_centro_de_familia: 1,
      prog_emergencia_climatica: 1,
    });
    expect(await prisma.participacionPrograma.count({ where: { dni: "91000002" } })).toBe(1);
  });

  it("una ficha sin DNI no entra al padrón y editarla no crea otra persona provisoria", async () => {
    loginAs(relevador1);
    const before = await prisma.padronUnificado.count();
    const res = await saveStormVictimAction({ ...ficha, nombreApellido: "Sin Documento Uno", dni: "" });
    expect(res.success).toBe(true);
    expect(await prisma.padronUnificado.count()).toBe(before);
    expect(await tempPeople()).toBe(1);

    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { nombreApellido: "Sin Documento Uno" } });
    await saveStormVictimAction({ ...ficha, id: record.id, caseId: record.caseId!, nombreApellido: "Sin Documento Uno", dni: "", observaciones: "editada" });
    expect(await tempPeople()).toBe(1);
    expect((await prisma.stormVictimRecord.findUniqueOrThrow({ where: { id: record.id } })).personId).toBe(record.personId);

    const data = await getEmergencyOperationsData(relevador1);
    expect(recordsWithoutDni(data.records).map((r) => r.nombreApellido)).toEqual(["Sin Documento Uno"]);
  });

  it("solo quien puede cargar fichas completa el DNI, y el relevador solo en las suyas", async () => {
    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { nombreApellido: "Sin Documento Uno" } });

    loginAs(auditor);
    expect((await completeStormRecordDniAction(record.id, "91000003")).success).toBe(false);
    expect(await lookupStormDniAction("91000002")).toBeNull();

    loginAs(relevador2);
    const ajena = await completeStormRecordDniAction(record.id, "91000003");
    expect(ajena).toEqual({ success: false, error: "Solo podés modificar las fichas que cargaste vos." });

    loginAs(relevador1);
    expect((await completeStormRecordDniAction(record.id, "12")).success).toBe(false);
    expect((await prisma.stormVictimRecord.findUniqueOrThrow({ where: { id: record.id } })).dni).toBeNull();
  });

  it("completar el DNI de alguien que ya tiene expediente une todo con esa persona", async () => {
    loginAs(relevador1);
    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { nombreApellido: "Sin Documento Uno" } });
    const tempId = record.personId!;
    const existing = await prisma.person.findUniqueOrThrow({ where: { dni: "91000002" } });

    const lookup = await lookupStormDniAction("91.000.002");
    expect(lookup).toEqual({ dni: "91000002", padron: { nombre: "Persona Del Padrón", direccion: "Dirección original 1" } });

    const res = await completeStormRecordDniAction(record.id, "91000002");
    expect(res).toMatchObject({ success: true, padron: "existing" });

    const after = await prisma.stormVictimRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(after).toMatchObject({ dni: "91000002", personId: existing.id });
    expect(await prisma.person.findUnique({ where: { id: tempId } })).toBeNull();
    expect((await prisma.case.findUniqueOrThrow({ where: { id: record.caseId! } })).personId).toBe(existing.id);
    expect(await prisma.intervention.count({ where: { caseId: record.caseId! } })).toBeGreaterThan(0);
    expect(await prisma.intervention.count({ where: { caseId: record.caseId!, personId: { not: existing.id } } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "STORM_RECORD_DNI_COMPLETED", entityId: record.id } })).toBe(1);

    expect(await completeStormRecordDniAction(record.id, "91000005")).toEqual({ success: false, error: "Esta ficha ya tiene DNI." });
  });

  it("completar un DNI nuevo le pone ese DNI a la persona y la suma al padrón", async () => {
    loginAs(operativo);
    await saveStormVictimAction({ ...ficha, nombreApellido: "Sin Documento Dos", dni: "" });
    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { nombreApellido: "Sin Documento Dos" } });

    expect(await lookupStormDniAction("91000004")).toEqual({ dni: "91000004", padron: null });
    const res = await completeStormRecordDniAction(record.id, "91000004");
    expect(res).toMatchObject({ success: true, padron: "created" });

    const person = await prisma.person.findUniqueOrThrow({ where: { id: record.personId! } });
    expect(person.dni).toBe("91000004");
    expect(await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "91000004" } })).toMatchObject({
      nombre_completo: "Sin Documento Dos",
      prog_emergencia_climatica: 1,
    });
    expect(await tempPeople()).toBe(0);
  });

  it("editar la ficha y escribir el DNI también une a la persona provisoria", async () => {
    loginAs(operativo);
    await saveStormVictimAction({ ...ficha, nombreApellido: "Sin Documento Tres", dni: "" });
    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { nombreApellido: "Sin Documento Tres" } });
    expect(await tempPeople()).toBe(1);

    await saveStormVictimAction({ ...ficha, id: record.id, caseId: record.caseId!, nombreApellido: "Sin Documento Tres", dni: "91000001" });
    const existing = await prisma.person.findUniqueOrThrow({ where: { dni: "91000001" } });
    expect(await tempPeople()).toBe(0);
    expect((await prisma.stormVictimRecord.findUniqueOrThrow({ where: { id: record.id } })).personId).toBe(existing.id);
    expect(await prisma.intervention.count({ where: { caseId: record.caseId!, personId: { not: existing.id } } })).toBe(0);
  });
});
