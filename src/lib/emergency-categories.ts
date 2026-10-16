// Elementos que se piden en las fichas de tormenta y cómo se calcula lo
// pendiente de entregar. Sin acceso a la base: se usa en el servidor y en pantalla.

import type { StormVictimItem } from "@/types/emergency";

export type EmergencyCategoryKey = "COLCHON" | "CAMA" | "CUCHETA" | "FRAZADA";

export const EMERGENCY_CATEGORIES: Array<{
  key: EmergencyCategoryKey;
  /** En plural y minúscula, para armar frases ("3 colchones"). */
  label: string;
  singular: string;
  title: string;
  searchNames: string[];
  defaultName: string;
  unit: string;
  minStock: number;
}> = [
  { key: "COLCHON", label: "colchones", singular: "colchón", title: "Colchones", searchNames: ["colchon", "colchón"], defaultName: "Colchones de Contingencia (1 plaza)", unit: "Unidades", minStock: 20 },
  { key: "CAMA", label: "camas", singular: "cama", title: "Camas", searchNames: ["cama"], defaultName: "Camas / Elasticos de Emergencia", unit: "Unidades", minStock: 10 },
  { key: "CUCHETA", label: "cuchetas", singular: "cucheta", title: "Cuchetas", searchNames: ["cucheta"], defaultName: "Cuchetas Superpuestas Reforzadas", unit: "Unidades", minStock: 10 },
  { key: "FRAZADA", label: "frazadas", singular: "frazada", title: "Frazadas", searchNames: ["frazada", "manta"], defaultName: "Frazadas Térmicas Antialérgicas", unit: "Unidades", minStock: 30 },
];

/** Qué insumo del depósito corresponde a cada elemento de las fichas (se guarda al crearlo o renombrarlo). */
export type CategoryLinks = Partial<Record<EmergencyCategoryKey, string>>;

/**
 * El insumo del depósito que corresponde a un elemento de las fichas: el vinculado
 * si hay uno (así se puede renombrar) y si no, el primero que lo nombre.
 */
export function findCategorySupply<T extends { id: string; name: string }>(
  supplies: T[],
  key: EmergencyCategoryKey,
  links: CategoryLinks = {}
): T | undefined {
  const linkedId = links[key];
  const linked = linkedId ? supplies.find((s) => s.id === linkedId) : undefined;
  if (linked) return linked;
  const cat = EMERGENCY_CATEGORIES.find((c) => c.key === key);
  const linkedElsewhere = new Set(Object.values(links));
  return cat
    ? supplies.find((s) => !linkedElsewhere.has(s.id) && cat.searchNames.some((sn) => s.name.toLowerCase().includes(sn)))
    : undefined;
}

export function requestedByCategory(r: StormVictimItem): Record<EmergencyCategoryKey, number> {
  return {
    COLCHON: r.cantidadColchon || 0,
    CAMA: r.cantidadCama || 0,
    CUCHETA: r.cantidadCucheta || 0,
    FRAZADA: r.cantidadFrazada || 0,
  };
}

export function deliveredByCategory(r: StormVictimItem): Record<EmergencyCategoryKey, number> {
  return {
    COLCHON: r.entregadoColchon || 0,
    CAMA: r.entregadoCama || 0,
    CUCHETA: r.entregadoCucheta || 0,
    FRAZADA: r.entregadoFrazada || 0,
  };
}

/** Lo que falta entregar de una ficha, por elemento. */
export function pendingByCategory(r: StormVictimItem): Record<EmergencyCategoryKey, number> {
  const req = requestedByCategory(r);
  const del = deliveredByCategory(r);
  return {
    COLCHON: Math.max(0, req.COLCHON - del.COLCHON),
    CAMA: Math.max(0, req.CAMA - del.CAMA),
    CUCHETA: Math.max(0, req.CUCHETA - del.CUCHETA),
    FRAZADA: Math.max(0, req.FRAZADA - del.FRAZADA),
  };
}

export type DeliveryStatus = "SIN_PEDIDO" | "PENDIENTE" | "PARCIAL" | "ENTREGADO";

export function deliveryStatus(r: StormVictimItem): DeliveryStatus {
  const requested = Object.values(requestedByCategory(r)).reduce((a, b) => a + b, 0);
  if (requested === 0) return "SIN_PEDIDO";
  const pending = Object.values(pendingByCategory(r)).reduce((a, b) => a + b, 0);
  if (pending === 0) return "ENTREGADO";
  const delivered = Object.values(deliveredByCategory(r)).reduce((a, b) => a + b, 0);
  return delivered > 0 ? "PARCIAL" : "PENDIENTE";
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  SIN_PEDIDO: "Sin pedidos",
  PENDIENTE: "Pendiente de entrega",
  PARCIAL: "Entrega parcial",
  ENTREGADO: "Entregado",
};

/** "1 colchón", "3 colchones". */
export function quantityText(key: EmergencyCategoryKey, n: number): string {
  const cat = EMERGENCY_CATEGORIES.find((c) => c.key === key)!;
  return `${n} ${n === 1 ? cat.singular : cat.label}`;
}
