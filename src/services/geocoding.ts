import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  TRES_DE_FEBRERO_GEOREF_ID,
  buildOsmQuery,
  cleanAddressForSearch,
  insideTresDeFebreroBounds,
  type GeoFuente,
  type GeocodingStatus,
} from "@/lib/geocoding";

// Ubica en el mapa las direcciones del padrón.
// 1. Georef (servicio oficial de direcciones del Estado, datos.gob.ar): rápido, de a muchas.
// 2. OpenStreetMap para las que Georef no encontró: de a una por segundo, como pide su política de uso.
// 3. Las que no aparecen quedan para corregir la dirección o marcar el punto a mano.

const GEOREF_URL = "https://apis.datos.gob.ar/georef/api";
const OSM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MuniGestion3F/1.0 (Municipalidad de Tres de Febrero)";

export const GEOREF_BATCH = 100;
export const OSM_BATCH = 5;
const OSM_DELAY_MS = 1100;

/** Error de un servicio externo: se corta la tanda sin marcar nada. */
export class GeocodingServiceError extends Error {}

type Point = { lat: number; lon: number };

const hasAddress: Prisma.PadronUnificadoWhereInput = { AND: [{ direccion: { not: null } }, { direccion: { not: "" } }] };

export async function getGeocodingStatus(): Promise<GeocodingStatus> {
  const [located, pending, pendingOsm, notFound, unusableAddress, withoutAddress] = await Promise.all([
    prisma.padronUnificado.count({ where: { latitude: { not: null } } }),
    prisma.padronUnificado.count({ where: { latitude: null, geo_estado: null, ...hasAddress } }),
    prisma.padronUnificado.count({ where: { latitude: null, geo_estado: "SIN_GEOREF" } }),
    prisma.padronUnificado.count({ where: { latitude: null, geo_estado: "NO_ENCONTRADA" } }),
    prisma.padronUnificado.count({ where: { latitude: null, geo_estado: "SIN_DIRECCION" } }),
    prisma.padronUnificado.count({ where: { latitude: null, OR: [{ direccion: null }, { direccion: "" }] } }),
  ]);
  return { located, pending, pendingOsm, notFound, unusableAddress, withoutAddress };
}

async function fetchJson(url: string, init: RequestInit, service: string) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000), cache: "no-store" });
  } catch {
    throw new GeocodingServiceError(`${service} no responde. Probá de nuevo en unos minutos.`);
  }
  if (!res.ok) {
    throw new GeocodingServiceError(
      res.status === 429
        ? `${service} pidió esperar un rato antes de seguir. Probá de nuevo en unos minutos.`
        : `${service} respondió con un error (${res.status}). Probá de nuevo en unos minutos.`
    );
  }
  return res.json();
}

/** Busca varias direcciones en Georef dentro de Tres de Febrero. */
export async function georefLookup(addresses: string[]): Promise<(Point | null)[]> {
  if (addresses.length === 0) return [];
  const body = {
    direcciones: addresses.map((direccion) => ({
      direccion,
      departamento: TRES_DE_FEBRERO_GEOREF_ID,
      max: 1,
      campos: "ubicacion.lat,ubicacion.lon",
    })),
  };
  const data = await fetchJson(
    `${GEOREF_URL}/direcciones`,
    { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT }, body: JSON.stringify(body) },
    "Georef"
  );
  const results: any[] = Array.isArray(data?.resultados) ? data.resultados : [];
  return addresses.map((_, i) => {
    const u = results[i]?.direcciones?.[0]?.ubicacion;
    const lat = Number(u?.lat);
    const lon = Number(u?.lon);
    return u && u.lat !== null && Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  });
}

/** ¿El punto cae dentro del partido? Lo confirma Georef; si no responde, alcanza con el rectángulo del partido. */
export async function isInsideTresDeFebrero(point: Point): Promise<boolean> {
  if (!insideTresDeFebreroBounds(point.lat, point.lon)) return false;
  try {
    const data = await fetchJson(
      `${GEOREF_URL}/ubicacion?lat=${point.lat}&lon=${point.lon}&campos=departamento.id`,
      { headers: { "User-Agent": USER_AGENT } },
      "Georef"
    );
    const id = data?.ubicacion?.departamento?.id;
    return id ? id === TRES_DE_FEBRERO_GEOREF_ID : true;
  } catch {
    return true;
  }
}

/** Busca una dirección en OpenStreetMap. Solo acepta resultados con la altura exacta dentro del partido. */
export async function osmLookup(address: string, localidad?: string | null, barrio?: string | null): Promise<Point | null> {
  const q = encodeURIComponent(buildOsmQuery(address, localidad, barrio));
  const data = await fetchJson(
    `${OSM_URL}?format=jsonv2&limit=1&countrycodes=ar&addressdetails=1&q=${q}`,
    { headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" } },
    "OpenStreetMap"
  );
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit?.address?.house_number) return null;
  const point = { lat: Number(hit.lat), lon: Number(hit.lon) };
  return (await isInsideTresDeFebrero(point)) ? point : null;
}

async function saveLocation(dni: string, point: Point, fuente: GeoFuente) {
  await prisma.padronUnificado.update({
    where: { dni },
    data: {
      latitude: point.lat,
      longitude: point.lon,
      geo_estado: fuente === "MANUAL" ? "MANUAL" : "UBICADA",
      geo_fuente: fuente,
      geo_actualizado: new Date(),
    },
  });
  // La persona del Registro Único con el mismo DNI toma el mismo punto si no tenía uno (o si se marcó a mano).
  await prisma.person.updateMany({
    where: fuente === "MANUAL" ? { dni } : { dni, latitude: null },
    data: { latitude: point.lat, longitude: point.lon },
  });
}

async function markState(dnis: string[], geo_estado: string) {
  if (dnis.length === 0) return;
  await prisma.padronUnificado.updateMany({ where: { dni: { in: dnis } }, data: { geo_estado, geo_actualizado: new Date() } });
}

export interface GeocodeBatchResult {
  processed: number;
  located: number;
  notFound: number;
}

/** Busca en Georef la próxima tanda de direcciones sin buscar. */
export async function geocodeNextGeorefBatch(limit = GEOREF_BATCH): Promise<GeocodeBatchResult> {
  const rows = await prisma.padronUnificado.findMany({
    where: { latitude: null, geo_estado: null, ...hasAddress },
    select: { dni: true, direccion: true },
    orderBy: { dni: "asc" },
    take: limit,
  });
  const unusable: string[] = [];
  const toSearch: { dni: string; address: string }[] = [];
  for (const r of rows) {
    const address = cleanAddressForSearch(r.direccion);
    if (address) toSearch.push({ dni: r.dni, address });
    else unusable.push(r.dni);
  }

  const points = await georefLookup(toSearch.map((r) => r.address));
  const missing: string[] = [];
  let located = 0;
  for (let i = 0; i < toSearch.length; i++) {
    const point = points[i];
    if (point) {
      await saveLocation(toSearch[i].dni, point, "GEOREF");
      located++;
    } else {
      missing.push(toSearch[i].dni);
    }
  }
  await markState(unusable, "SIN_DIRECCION");
  await markState(missing, "SIN_GEOREF");
  return { processed: rows.length, located, notFound: missing.length + unusable.length };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Prueba con OpenStreetMap las direcciones que Georef no encontró (de a una por segundo). */
export async function geocodeNextOsmBatch(limit = OSM_BATCH): Promise<GeocodeBatchResult> {
  const rows = await prisma.padronUnificado.findMany({
    where: { latitude: null, geo_estado: "SIN_GEOREF" },
    select: { dni: true, direccion: true, localidad: true, barrio: true },
    orderBy: { dni: "asc" },
    take: limit,
  });
  let located = 0;
  let notFound = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await sleep(OSM_DELAY_MS);
    const r = rows[i];
    const address = cleanAddressForSearch(r.direccion);
    const point = address ? await osmLookup(address, r.localidad, r.barrio) : null;
    if (point) {
      await saveLocation(r.dni, point, "OSM");
      located++;
    } else {
      await markState([r.dni], "NO_ENCONTRADA");
      notFound++;
    }
  }
  return { processed: rows.length, located, notFound };
}

/** Corrige la dirección de una persona y la vuelve a buscar (Georef y, si hace falta, OpenStreetMap). */
export async function retryWithAddress(dni: string, direccion: string): Promise<{ located: boolean; fuente?: GeoFuente }> {
  const text = direccion.replace(/\s+/g, " ").trim().slice(0, 200);
  await prisma.padronUnificado.update({ where: { dni }, data: { direccion: text, latitude: null, longitude: null, geo_estado: null } });
  const address = cleanAddressForSearch(text);
  if (!address) {
    await markState([dni], "SIN_DIRECCION");
    return { located: false };
  }
  const [georef] = await georefLookup([address]);
  if (georef) {
    await saveLocation(dni, georef, "GEOREF");
    return { located: true, fuente: "GEOREF" };
  }
  const row = await prisma.padronUnificado.findUnique({ where: { dni }, select: { localidad: true, barrio: true } });
  const osm = await osmLookup(address, row?.localidad, row?.barrio);
  if (osm) {
    await saveLocation(dni, osm, "OSM");
    return { located: true, fuente: "OSM" };
  }
  await markState([dni], "NO_ENCONTRADA");
  return { located: false };
}

/** Guarda el punto que alguien marcó a mano en el mapa. */
export async function setManualLocation(dni: string, point: Point): Promise<boolean> {
  if (!(await isInsideTresDeFebrero(point))) return false;
  await saveLocation(dni, point, "MANUAL");
  return true;
}

export interface GeocodingReviewRow {
  dni: string;
  nombre: string;
  direccion: string | null;
  barrio: string | null;
  localidad: string | null;
  motivo: "NO_ENCONTRADA" | "SIN_DIRECCION";
}

/** Personas a revisar: la dirección no se encontró o no tiene calle y altura. */
export async function listGeocodingReview(query = "", page = 1, pageSize = 20) {
  const q = query.trim();
  const where: Prisma.PadronUnificadoWhereInput = {
    latitude: null,
    geo_estado: { in: ["NO_ENCONTRADA", "SIN_DIRECCION"] },
    ...(q
      ? {
          OR: [
            { dni: { contains: q.replace(/\D/g, "") || q } },
            { nombre_completo: { contains: q, mode: "insensitive" } },
            { direccion: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.padronUnificado.count({ where }),
    prisma.padronUnificado.findMany({
      where,
      select: { dni: true, nombre_completo: true, direccion: true, barrio: true, localidad: true, geo_estado: true },
      orderBy: [{ nombre_completo: "asc" }, { dni: "asc" }],
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    total,
    rows: rows.map(
      (r): GeocodingReviewRow => ({
        dni: r.dni,
        nombre: r.nombre_completo || "Sin nombre",
        direccion: r.direccion,
        barrio: r.barrio,
        localidad: r.localidad,
        motivo: r.geo_estado === "SIN_DIRECCION" ? "SIN_DIRECCION" : "NO_ENCONTRADA",
      })
    ),
  };
}
