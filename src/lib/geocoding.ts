// Ubicar direcciones del padrón en el mapa. Sin acceso a la base ni a internet:
// limpieza de direcciones y controles, para usar en el servidor y en pantalla.

/** Código del partido de Tres de Febrero en Georef (INDEC). */
export const TRES_DE_FEBRERO_GEOREF_ID = "06840";

/** Rectángulo que contiene al partido (con un pequeño margen). */
export const TRES_DE_FEBRERO_BOUNDS = { south: -34.658, north: -34.544, west: -58.65, east: -58.519 };

export type GeoEstado = "SIN_GEOREF" | "UBICADA" | "NO_ENCONTRADA" | "SIN_DIRECCION" | "MANUAL";
export type GeoFuente = "GEOREF" | "OSM" | "MANUAL";

export function insideTresDeFebreroBounds(lat: number, lon: number): boolean {
  const b = TRES_DE_FEBRERO_BOUNDS;
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;
}

/**
 * Deja la dirección lista para buscarla: sin "N°", piso, departamento ni
 * aclaraciones entre paréntesis. Devuelve null si no tiene calle y altura.
 */
export function cleanAddressForSearch(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = String(raw)
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(?:n[°º]|no\.|nro\.?|n[uú]mero)(?![a-záéíóúñ])\s*/gi, " ")
    .replace(/[°º]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Lo que viene después de piso/depto/dto/torre/casa/entre calles no ayuda a ubicar la casa.
  text = text.replace(/[,\s]+(?:piso|p\.|depto|dpto|dto|departamento|torre|tira|casa|lote|e\/|entre)(?![a-záéíóúñ]).*$/i, "").trim();
  text = text.replace(/[,;.\s]+$/, "");
  // Hace falta una calle y una altura.
  if (!/[a-záéíóúñ]{2,}/i.test(text) || !/\b\d{1,5}\b/.test(text)) return null;
  return text.slice(0, 150);
}

/** Texto para OpenStreetMap: la dirección con la localidad o el barrio y el partido. */
export function buildOsmQuery(address: string, localidad?: string | null, barrio?: string | null): string {
  const place = [localidad, barrio].map((v) => (v || "").trim()).find((v) => v && !/tres de febrero/i.test(v));
  return [address, place, "Tres de Febrero", "Buenos Aires", "Argentina"].filter(Boolean).join(", ");
}

export interface GeocodingStatus {
  /** Ya tienen ubicación en el mapa. */
  located: number;
  /** Tienen dirección y todavía no se buscaron. */
  pending: number;
  /** Georef no las encontró y falta probar con OpenStreetMap. */
  pendingOsm: number;
  /** No se encontraron: hay que corregir la dirección o marcarlas a mano. */
  notFound: number;
  /** Tienen una dirección cargada pero sin calle y altura reconocibles. */
  unusableAddress: number;
  /** No tienen dirección cargada. */
  withoutAddress: number;
}
