import prisma from "@/lib/prisma";
import { EMERGENCY_CATEGORIES, cleanItemQuantities, extraQuantityText, quantityText } from "@/lib/emergency-categories";
import { isDeliveryTableReady } from "@/services/emergency-db-status";
import type { StormDeliveryListItem } from "@/types/emergency";

// Constancias de entrega de las fichas de tormenta: lo que se le entregó a una
// familia en una entrega, para imprimir y que firme quien recibe.

const FIELD_BY_CATEGORY = { COLCHON: "colchones", CAMA: "camas", CUCHETA: "cuchetas", FRAZADA: "frazadas" } as const;

const recordSelect = {
  id: true,
  nombreApellido: true,
  dni: true,
  domicilio: true,
  referencia: true,
  barrio: true,
  contacto: true,
  grupoFamiliar: true,
  ninos: true,
} as const;

type DeliveryRow = {
  id: string;
  colchones: number;
  camas: number;
  cuchetas: number;
  frazadas: number;
  otrosElementos: unknown;
  observaciones: string | null;
  userName: string;
  createdAt: Date;
};

/** Número que se imprime en la constancia: fecha de la entrega y el final de su identificador. */
export function receiptNumber(id: string, date: Date): string {
  const day = date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).replace(/-/g, "");
  return `ENT-${day}-${id.slice(-6).toUpperCase()}`;
}

async function supplyNames(deliveries: DeliveryRow[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(deliveries.flatMap((d) => Object.keys(cleanItemQuantities(d.otrosElementos)))));
  if (ids.length === 0) return new Map();
  const items = await prisma.supplyItem.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(items.map((s) => [s.id, s.name]));
}

function deliveryItems(d: DeliveryRow, names: Map<string, string>) {
  return [
    ...EMERGENCY_CATEGORIES.filter((c) => d[FIELD_BY_CATEGORY[c.key]] > 0).map((c) => ({
      name: c.title,
      quantity: d[FIELD_BY_CATEGORY[c.key]],
      text: quantityText(c.key, d[FIELD_BY_CATEGORY[c.key]]),
    })),
    ...Object.entries(cleanItemQuantities(d.otrosElementos)).map(([id, n]) => ({
      name: names.get(id) || "Insumo eliminado",
      quantity: n,
      text: extraQuantityText(id, n, names),
    })),
  ];
}

export type DeliveryReceipt = {
  id: string;
  number: string;
  date: string;
  deliveredBy: string;
  observaciones: string | null;
  family: {
    recordId: string;
    nombre: string;
    dni: string | null;
    domicilio: string;
    referencia: string | null;
    barrio: string | null;
    contacto: string | null;
    grupoFamiliar: boolean;
    ninos: string | null;
  };
  items: { name: string; quantity: number }[];
};

export async function getDeliveryReceipt(deliveryId: string): Promise<DeliveryReceipt | null> {
  if (!(await isDeliveryTableReady())) return null;
  const d = await prisma.stormDelivery.findUnique({ where: { id: deliveryId }, include: { record: { select: recordSelect } } });
  if (!d) return null;
  const names = await supplyNames([d]);
  return {
    id: d.id,
    number: receiptNumber(d.id, d.createdAt),
    date: d.createdAt.toISOString(),
    deliveredBy: d.userName,
    observaciones: d.observaciones,
    family: {
      recordId: d.record.id,
      nombre: d.record.nombreApellido,
      dni: d.record.dni,
      domicilio: d.record.domicilio,
      referencia: d.record.referencia,
      barrio: d.record.barrio,
      contacto: d.record.contacto,
      grupoFamiliar: d.record.grupoFamiliar,
      ninos: d.record.ninos,
    },
    items: deliveryItems(d, names).map(({ name, quantity }) => ({ name, quantity })),
  };
}

/** Últimas entregas registradas, las más nuevas primero. */
export async function getRecentDeliveries(limit = 100): Promise<StormDeliveryListItem[]> {
  if (!(await isDeliveryTableReady())) return [];
  const deliveries = await prisma.stormDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { record: { select: recordSelect } },
  });
  const names = await supplyNames(deliveries);
  return deliveries.map((d) => ({
    id: d.id,
    number: receiptNumber(d.id, d.createdAt),
    date: d.createdAt.toISOString(),
    nombre: d.record.nombreApellido,
    dni: d.record.dni,
    barrio: d.record.barrio,
    domicilio: d.record.domicilio,
    summary: deliveryItems(d, names).map((i) => i.text).join(", "),
    deliveredBy: d.userName,
  }));
}
