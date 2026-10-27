import { BARRIOS_3F, matchBarrio } from "@/lib/barrios";

// Barrios que se eligen en la ficha de tormenta: la lista oficial de src/lib/barrios.ts.

export const STORM_BARRIOS = BARRIOS_3F;

/**
 * Devuelve el barrio de la lista que corresponde a un texto escrito a mano
 * (sin importar tildes ni mayúsculas), o null si no está en la lista.
 */
export function matchStormBarrio(value: string | null | undefined): string | null {
  return matchBarrio(value);
}

export const SIN_BARRIO = "Sin barrio";

/** Nombre con el que se agrupa una ficha por barrio: el de la lista, el texto viejo tal cual, o "Sin barrio". */
export function stormBarrioLabel(value: string | null | undefined): string {
  return matchStormBarrio(value) ?? ((value || "").trim() || SIN_BARRIO);
}
