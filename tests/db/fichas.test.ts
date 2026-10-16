import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { saveStormVictimAction, deleteStormVictimAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import { getEmergencyOperationsData } from "@/services/emergency";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
const fichaBase = {
  nombreApellido: "Vecina Prueba",
  dni: "90000001",
  domicilio: "Calle Falsa 123",
  barrio: "Barrio de prueba",
  requiereColchon: true,
  cantidadColchon: 2,
  prioridad: "ALTA" as const,
};

describe("fichas de emergencia", () => {
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
  });

  it("al guardar una ficha se crean la ficha, la persona y el expediente", async () => {
    loginAs(operativo);
    const res = await saveStormVictimAction(fichaBase);
    expect(res.success).toBe(true);

    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { dni: "90000001" } });
    expect(record.cantidadColchon).toBe(2);
    expect(record.createdById).toBe(operativo.id);
    expect(record.caseId).toBeTruthy();
    const caso = await prisma.case.findUniqueOrThrow({ where: { id: record.caseId! } });
    expect(caso.priority).toBe("ALTA");
    expect(await prisma.person.count({ where: { dni: "90000001" } })).toBe(1);
  });

  it("Auditoría no puede cargar fichas", async () => {
    loginAs(auditor);
    const res = await saveStormVictimAction({ ...fichaBase, dni: "90000002" });
    expect(res.success).toBe(false);
    expect(await prisma.stormVictimRecord.count({ where: { dni: "90000002" } })).toBe(0);
  });

  it("sin sesión no se guarda nada", async () => {
    loginAs(null);
    const res = await saveStormVictimAction({ ...fichaBase, dni: "90000003" });
    expect(res.success).toBe(false);
    expect(await prisma.stormVictimRecord.count({ where: { dni: "90000003" } })).toBe(0);
  });

  it("una ficha cargada sin conexión que llega dos veces no se duplica", async () => {
    loginAs(relevador1);
    const ficha = { ...fichaBase, dni: "90000004", clientId: "dispositivo-1-ficha-1" };
    const first = await saveStormVictimAction(ficha);
    const second = await saveStormVictimAction(ficha);
    expect(first.success).toBe(true);
    expect(second.success && second.duplicate).toBe(true);
    expect(await prisma.stormVictimRecord.count({ where: { clientId: "dispositivo-1-ficha-1" } })).toBe(1);
    expect(await prisma.case.count({ where: { person: { dni: "90000004" } } })).toBe(1);
  });

  it("el relevador ve solo sus fichas y no ve el stock", async () => {
    loginAs(relevador2);
    await saveStormVictimAction({ ...fichaBase, dni: "90000005" });

    const data = await getEmergencyOperationsData(relevador2);
    expect(data.records.map((r) => r.dni)).toEqual(["90000005"]);
    expect(data.stock).toEqual([]);
    expect(data.viewer.canViewStock).toBe(false);
    expect(data.viewer.canDeliver).toBe(false);
  });

  it("el relevador no puede modificar ni borrar fichas de otra persona", async () => {
    const ajena = await prisma.stormVictimRecord.findFirstOrThrow({ where: { dni: "90000004" } });
    loginAs(relevador2);

    const edit = await saveStormVictimAction({ ...fichaBase, id: ajena.id, dni: "90000004", cantidadColchon: 9 });
    expect(edit.success).toBe(false);
    const del = await deleteStormVictimAction(ajena.id);
    expect(del.success).toBe(false);

    const after = await prisma.stormVictimRecord.findUniqueOrThrow({ where: { id: ajena.id } });
    expect(after.cantidadColchon).toBe(2);
  });

  it("el relevador sí puede corregir sus propias fichas", async () => {
    const propia = await prisma.stormVictimRecord.findFirstOrThrow({ where: { dni: "90000004" } });
    loginAs(relevador1);
    const res = await saveStormVictimAction({ ...fichaBase, id: propia.id, caseId: propia.caseId ?? undefined, dni: "90000004", cantidadColchon: 3 });
    expect(res.success).toBe(true);
    expect((await prisma.stormVictimRecord.findUniqueOrThrow({ where: { id: propia.id } })).cantidadColchon).toBe(3);
  });

  it("los otros insumos que no existen en el depósito no se guardan", async () => {
    loginAs(operativo);
    await saveStormVictimAction({ ...fichaBase, dni: "90000006", otrosElementos: { "insumo-inexistente": 5 } });
    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { dni: "90000006" } });
    expect(record.otrosElementos).toEqual({});
  });
});
