import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
  createEmergencyStockItemAction,
  deliverStormItemsAction,
  saveStormVictimAction,
  updateEmergencyStockAction,
} from "@/app/(dashboard)/admin/actions/emergency-actions";
import { addCaseInterventionAction, createDerivationAction, respondDerivationAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { closeCaseAction } from "@/app/(dashboard)/people/actions/close-case";
import { getDeliveryReceipt, getRecentDeliveries } from "@/services/storm-receipts";
import { getEmergencyOperationsData, getEmergencyStock } from "@/services/emergency";
import { getCaseDerivations } from "@/services/derivations";
import { getCaseEvents } from "@/services/case-timeline";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("constancia de entrega", () => {
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let fichaId: string;
  let chapasId: string;

  beforeAll(async () => {
    const area = await createArea("Desarrollo Humano (prueba)");
    operativo = await createUser("OPERATIVO", area.id);
    loginAs(operativo);
    expect((await updateEmergencyStockAction("stock-cat-colchon", 10)).success).toBe(true);
    expect((await createEmergencyStockItemAction({ name: "Chapas", availableStock: 5 })).success).toBe(true);
    chapasId = (await getEmergencyStock()).find((s) => s.name === "Chapas")!.id;
    const res = await saveStormVictimAction({
      nombreApellido: "Vecina Constancia",
      dni: "92000001",
      domicilio: "Calle Inventada 789",
      barrio: "Villa Bosch",
      requiereColchon: true,
      cantidadColchon: 3,
      otrosElementos: { [chapasId]: 2 },
    });
    expect(res.success).toBe(true);
    fichaId = (await prisma.stormVictimRecord.findFirstOrThrow({ where: { dni: "92000001" } })).id;
  });

  it("registrar una entrega devuelve su constancia con lo entregado y los datos de la familia", async () => {
    loginAs(operativo);
    const res = await deliverStormItemsAction(fichaId, { COLCHON: 2 }, "Recibió la hija", { [chapasId]: 1 });
    expect(res.success).toBe(true);
    const receipt = await getDeliveryReceipt(res.deliveryId!);
    expect(receipt).toMatchObject({
      deliveredBy: operativo.name,
      observaciones: "Recibió la hija",
      family: { nombre: "Vecina Constancia", dni: "92000001", barrio: "Villa Bosch", domicilio: "Calle Inventada 789" },
      items: [
        { name: "Colchones", quantity: 2 },
        { name: "Chapas", quantity: 1 },
      ],
    });
    expect(receipt!.number).toMatch(/^ENT-\d{8}-[A-Z0-9]{6}$/);
  });

  it("la lista de entregas muestra cada entrega para volver a imprimir su constancia", async () => {
    loginAs(operativo);
    const second = await deliverStormItemsAction(fichaId, { COLCHON: 1 });
    const list = await getRecentDeliveries();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: second.deliveryId, nombre: "Vecina Constancia", summary: "1 colchón" });
    expect(list[1].summary).toBe("2 colchones, 1 Chapas");
  });

  it("el relevador no recibe la lista de entregas; Auditoría sí", async () => {
    const relevador = await createUser("RELEVADOR_EMERGENCIA");
    expect((await getEmergencyOperationsData(relevador)).deliveries).toEqual([]);
    const auditor = await createUser("AUDITOR");
    expect((await getEmergencyOperationsData(auditor)).deliveries).toHaveLength(2);
  });

  it("una entrega que no existe no tiene constancia", async () => {
    expect(await getDeliveryReceipt("no-existe")).toBeNull();
  });
});

describe("historia del expediente", () => {
  it("junta apertura, derivaciones con su respuesta y cierre, con quién hizo cada cosa", async () => {
    const social = await createArea("Social historia (prueba)");
    const ninez = await createArea("Niñez historia (prueba)");
    const deSocial = await createUser("OPERATIVO", social.id);
    const deNinez = await createUser("OPERATIVO", ninez.id);
    const person = await prisma.person.create({ data: { dni: "93500001", firstName: "Persona", lastName: "Historia" } });
    const caso = await prisma.case.create({ data: { title: "Caso con historia", personId: person.id, areaId: social.id } });
    await prisma.auditLog.create({ data: { userId: deSocial.id, action: "CREATE_CASE", entity: "Case", entityId: caso.id } });

    loginAs(deSocial);
    expect((await addCaseInterventionAction(caso.id, "Primera visita", "VISITA")).success).toBe(true);
    expect(await createDerivationAction(caso.id, ninez.id, "Corresponde a Niñez")).toEqual({ success: true });
    loginAs(deNinez);
    expect(await respondDerivationAction((await prisma.derivation.findFirstOrThrow({ where: { caseId: caso.id } })).id, false, "No es de nuestra área")).toEqual({ success: true });
    loginAs(deSocial);
    expect(await createDerivationAction(caso.id, ninez.id, "Ahora sí corresponde")).toEqual({ success: true });
    loginAs(deNinez);
    const segunda = await prisma.derivation.findFirstOrThrow({ where: { caseId: caso.id, status: "PENDIENTE" } });
    expect(await respondDerivationAction(segunda.id, true)).toEqual({ success: true });
    expect((await closeCaseAction(caso.id, "Se resolvió")).success).toBe(true);

    const events = await getCaseEvents({ id: caso.id, createdAt: caso.createdAt, areaName: ninez.name }, await getCaseDerivations(caso.id));
    const byKind = (k: string) => events.filter((e) => e.kind === k);
    expect(byKind("APERTURA")).toEqual([expect.objectContaining({ author: deSocial.name, detail: `En ${social.name}.` })]);
    expect(byKind("DERIVACION").map((e) => e.outcome).sort()).toEqual(["ACEPTADA", "RECHAZADA"]);
    expect(byKind("RESPUESTA").map((e) => e.title).sort()).toEqual([`${ninez.name} aceptó la derivación`, `${ninez.name} rechazó la derivación`]);
    expect(byKind("RESPUESTA").find((e) => e.outcome === "RECHAZADA")?.detail).toContain("No es de nuestra área");
    expect(byKind("CIERRE")).toEqual([expect.objectContaining({ author: deNinez.name, detail: "Motivo: Se resolvió" })]);
  });
});
