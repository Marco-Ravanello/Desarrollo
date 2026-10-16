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

/**
 * Deja solo cantidades enteras positivas: { idInsumo: cantidad }. Si se pasa
 * `allowedIds`, descarta los insumos que no estén en la lista.
 */
export function cleanItemQuantities(value: unknown, allowedIds?: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Math.floor(Number(raw));
    if (!id || !Number.isFinite(n) || n <= 0) continue;
    if (allowedIds && !allowedIds.has(id)) continue;
    out[id] = Math.min(n, 100000);
  }
  return out;
}

/** Otros insumos pedidos en la ficha (chapas, nylon...). */
export function requestedExtras(r: StormVictimItem): Record<string, number> {
  return cleanItemQuantities(r.otrosElementos);
}

/** Lo que falta entregar de los otros insumos de la ficha. */
export function pendingExtras(r: StormVictimItem): Record<string, number> {
  const delivered = r.entregadoOtros || {};
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(requestedExtras(r))) {
    const left = n - (delivered[id] || 0);
    if (left > 0) out[id] = left;
  }
  return out;
}

const total = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);

export type DeliveryStatus = "SIN_PEDIDO" | "PENDIENTE" | "PARCIAL" | "ENTREGADO";

export function deliveryStatus(r: StormVictimItem): DeliveryStatus {
  const requested = total(requestedByCategory(r)) + total(requestedExtras(r));
  if (requested === 0) return "SIN_PEDIDO";
  const pending = total(pendingByCategory(r)) + total(pendingExtras(r));
  if (pending === 0) return "ENTREGADO";
  const delivered = total(deliveredByCategory(r)) + total(r.entregadoOtros || {});
  return delivered > 0 ? "PARCIAL" : "PENDIENTE";
}

/** "3 Chapas" (o "3 insumo eliminado" si ya no existe). */
export function extraQuantityText(id: string, n: number, names: Map<string, string>): string {
  return `${n} ${names.get(id) || "insumo eliminado"}`;
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
