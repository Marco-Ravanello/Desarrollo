import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
  createEmergencyStockItemAction,
  deliverStormItemsAction,
  editEmergencyStockItemAction,
  saveStormVictimAction,
  updateEmergencyStockAction,
} from "@/app/(dashboard)/admin/actions/emergency-actions";
import { getEmergencyStock } from "@/services/emergency";
import { createArea, createUser, loginAs, stockOf } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("entregas y stock de contingencia", () => {
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let colchonesId: string;
  let chapasId: string;
  let fichaId: string;

  beforeAll(async () => {
    const area = await createArea("Desarrollo Humano (prueba)");
    operativo = await createUser("OPERATIVO", area.id);
    loginAs(operativo);

    // Stock inicial: 10 colchones y 5 chapas (insumo agregado desde Emergencia).
    expect((await updateEmergencyStockAction("stock-cat-colchon", 10)).success).toBe(true);
    expect((await createEmergencyStockItemAction({ name: "Chapas", availableStock: 5 })).success).toBe(true);
    const stock = await getEmergencyStock();
    colchonesId = stock.find((s) => s.category === "COLCHON")!.id;
    chapasId = stock.find((s) => s.name === "Chapas")!.id;
    expect(stock.find((s) => s.id === chapasId)?.category).toBe("ADICIONAL");

    // Una ficha que pide 3 colchones y 2 chapas.
    const res = await saveStormVictimAction({
      nombreApellido: "Vecino Prueba",
      dni: "91000001",
      domicilio: "Calle Falsa 456",
      requiereColchon: true,
      cantidadColchon: 3,
      otrosElementos: { [chapasId]: 2 },
    });
    expect(res.success).toBe(true);
    fichaId = (await prisma.stormVictimRecord.findFirstOrThrow({ where: { dni: "91000001" } })).id;
  });

  it("lo pedido en las fichas aparece como demanda del stock", async () => {
    const stock = await getEmergencyStock();
    expect(stock.find((s) => s.id === colchonesId)?.demandedQuantity).toBe(3);
    expect(stock.find((s) => s.id === chapasId)?.demandedQuantity).toBe(2);
  });

  it("una entrega parcial descuenta del stock y deja la ficha en entrega parcial", async () => {
    const res = await deliverStormItemsAction(fichaId, { COLCHON: 2 });
    expect(res).toMatchObject({ success: true, estado: "ENTREGA_PARCIAL" });
    expect(await stockOf(colchonesId)).toBe(8);
    expect((await getEmergencyStock()).find((s) => s.id === colchonesId)?.demandedQuantity).toBe(1);
  });

  it("no deja entregar más de lo que falta en la ficha", async () => {
    const res = await deliverStormItemsAction(fichaId, { COLCHON: 2 });
    expect(res.success).toBe(false);
    expect(res.error).toContain("quedan 1 colchones");
    expect(await stockOf(colchonesId)).toBe(8);
  });

  it("no deja entregar elementos que la ficha no pidió", async () => {
    const res = await deliverStormItemsAction(fichaId, { CAMA: 1 });
    expect(res.success).toBe(false);
  });

  it("ni el relevador ni Auditoría pueden registrar entregas", async () => {
    for (const role of ["RELEVADOR_EMERGENCIA", "AUDITOR"] as const) {
      loginAs(await createUser(role));
      const res = await deliverStormItemsAction(fichaId, { COLCHON: 1 });
      expect(res.success).toBe(false);
    }
    loginAs(operativo);
    expect(await stockOf(colchonesId)).toBe(8);
  });

  it("renombrar un insumo no lo desvincula de las fichas", async () => {
    const res = await editEmergencyStockItemAction({ id: colchonesId, category: "COLCHON", name: "Colchones 1 plaza (nombre corregido)", stock: 8 });
    expect(res.success).toBe(true);
    const item = (await getEmergencyStock()).find((s) => s.id === colchonesId);
    expect(item?.category).toBe("COLCHON");
    expect(item?.name).toBe("Colchones 1 plaza (nombre corregido)");
  });

  it("si no alcanza el stock, no se registra nada", async () => {
    await prisma.supplyItem.update({ where: { id: chapasId }, data: { stock: 1 } });
    const res = await deliverStormItemsAction(fichaId, { COLCHON: 1 }, undefined, { [chapasId]: 2 });
    expect(res.success).toBe(false);
    expect(res.error).toContain("no alcanza el stock de Chapas");
    // La entrega se cancela entera: tampoco se descuenta el colchón.
    expect(await stockOf(colchonesId)).toBe(8);
    expect(await prisma.stormDelivery.count({ where: { recordId: fichaId } })).toBe(1);
    await prisma.supplyItem.update({ where: { id: chapasId }, data: { stock: 5 } });
  });

  it("al entregar lo que falta (con las chapas) la ficha queda entregada", async () => {
    const res = await deliverStormItemsAction(fichaId, { COLCHON: 1 }, "Entregado en domicilio", { [chapasId]: 2 });
    expect(res).toMatchObject({ success: true, estado: "ENTREGADO" });
    expect(await stockOf(colchonesId)).toBe(7);
    expect(await stockOf(chapasId)).toBe(3);

    const stock = await getEmergencyStock();
    expect(stock.find((s) => s.id === colchonesId)?.demandedQuantity).toBe(0);
    expect(stock.find((s) => s.id === chapasId)?.demandedQuantity).toBe(0);
    expect(await prisma.stormDelivery.count({ where: { recordId: fichaId } })).toBe(2);
  });

  it("una ficha ya entregada no admite más entregas", async () => {
    const res = await deliverStormItemsAction(fichaId, { COLCHON: 1 });
    expect(res.success).toBe(false);
    expect(await stockOf(colchonesId)).toBe(7);
  });
});
