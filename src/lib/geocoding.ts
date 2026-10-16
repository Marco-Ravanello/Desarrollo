// Ubicar direcciones del padrón en el mapa. Sin acceso a la base ni a internet:
// limpieza de direcciones y controles, para usar en el servidor y en pantalla.

/** Código del partido de Tres de Febrero en Georef (INDEC). */
export const TRES_DE_FEBRERO_GEOREF_ID = "06840";

/** Rectángulo que contiene al partido (con un pequeño margen). */
export const TRES_DE_FEBRERO_BOUNDS = { south: -34.658, north: -34.544, west: -58.65, east: -58.519 };

export type GeoEstado = "SIN_GEOREF" | "UBICADA" | "NO_ENCONTRADA" | "SIN_DIRECCION" | "MANUAL" | "APROXIMADA";
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
  // "Barrio Puerta 8", "Bº Libertador 2": es el nombre del barrio, no una calle.
  if (/^(barrio|b|bo\.?)\s/i.test(text) || /^puerta\s*(8|ocho)$/i.test(text)) return null;
  return text.slice(0, 150);
}

/**
 * `direccion_con_altura` la calcula la base con la misma regla que `cleanAddressForSearch(...) !== null`
 * (migración 20261016200000_padron_direccion_con_altura; una prueba de base compara las dos).
 *
 * Punto aproximado: vino de las planillas y la dirección cargada no tiene calle y altura
 * (solo el barrio), o se corrigió la dirección y no apareció pero conserva el punto viejo.
 * Los puntos que dieron Georef, OpenStreetMap o una persona a mano nunca son aproximados.
 */
export const APPROXIMATE_POINT_SQL = `(latitude IS NOT NULL AND (COALESCE(geo_estado, '') = 'APROXIMADA' OR (geo_fuente IS NULL AND geo_estado IS NULL AND NOT COALESCE(direccion_con_altura, false))))`;

/** La misma regla que APPROXIMATE_POINT_SQL, para una fila ya leída. */
export function isApproximatePoint(row: {
  latitude: number | null;
  direccion_con_altura: boolean | null;
  geo_estado: string | null;
  geo_fuente: string | null;
}): boolean {
  if (row.latitude == null) return false;
  if (row.geo_estado === "APROXIMADA") return true;
  return !row.geo_fuente && !row.geo_estado && !row.direccion_con_altura;
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
  /** Tienen un punto aproximado (solo el barrio): se ven en el mapa pero conviene corregirlas. */
  approximate: number;
}
