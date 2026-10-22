import prisma from "@/lib/prisma";
import { buildMapWhere, normalizeMapFilters, type MapFilters } from "@/lib/map-filters";
import { APPROXIMATE_POINT_SQL, isApproximatePoint } from "@/lib/geocoding";
import type { MapStats, PackedMapData } from "@/lib/map-points";

// Datos del Mapa Social. Al navegador viajan solo los puntos (DNI y coordenadas);
// el nombre, la dirección y los programas se piden al tocar un punto.

/** Tope de seguridad: alcanza para todo el padrón actual con margen. */
export const MAP_POINTS_LIMIT = 200000;

export type { MapData, MapStats, PackedMapData } from "@/lib/map-points";

export interface MapPerson {
  dni: string;
  nombre: string;
  direccion: string | null;
  barrio: string | null;
  localidad: string | null;
  telefono: string | null;
  programas: string[];
  /** El punto es aproximado: la dirección cargada solo tiene el barrio. */
  aproximada: boolean;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Las cifras de arriba del mapa. Son rápidas: la página las muestra enseguida y los puntos llegan después. */
export async function getMapStats(filters: MapFilters): Promise<MapStats> {
  const { where, params } = buildMapWhere(filters);
  const [totals, barrios, programs] = await Promise.all([
    prisma.$queryRawUnsafe<{ total: number; located: number; approximate: number }[]>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL)::int AS located,
              COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND ${APPROXIMATE_POINT_SQL})::int AS approximate
       FROM padron_unificado WHERE ${where}`,
      ...params
    ),
    prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT COALESCE(NULLIF(trim(barrio), ''), NULLIF(trim(localidad), '')) AS name
       FROM padron_unificado WHERE ${where} AND COALESCE(NULLIF(trim(barrio), ''), NULLIF(trim(localidad), '')) IS NOT NULL
       GROUP BY 1 ORDER BY COUNT(*) DESC, 1 LIMIT 1`,
      ...params
    ),
    prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT trim(prog) AS name
       FROM padron_unificado, unnest(string_to_array(COALESCE(programas_activos, ''), '|')) AS prog
       WHERE ${where} AND trim(prog) <> ''
       GROUP BY 1 ORDER BY COUNT(*) DESC, 1 LIMIT 1`,
      ...params
    ),
  ]);
  const located = Math.min(totals[0]?.located ?? 0, MAP_POINTS_LIMIT);
  return {
    total: totals[0]?.total ?? 0,
    located,
    approximate: Math.min(totals[0]?.approximate ?? 0, located),
    topBarrio: barrios[0]?.name || "Sin datos",
    topProgram: programs[0]?.name || "Sin datos",
  };
}

/**
 * Puntos y cifras del mapa con los filtros. La base arma directamente el texto que viaja
 * al navegador (ver lib/map-points.ts): con todo el padrón es mucho más rápido que leer fila por fila.
 */
export async function getMapData(filters: MapFilters): Promise<PackedMapData> {
  const withMask = buildMapWhere(filters, { withMask: true });
  const comparing = normalizeMapFilters(filters).programs.length > 0;
  const [points, stats] = await Promise.all([
    prisma.$queryRawUnsafe<{ exact: number; dnis: string; coords: string; masks: string | null }[]>(
      `SELECT COUNT(*) FILTER (WHERE NOT approx)::int AS exact,
              COALESCE(string_agg(dni, ',' ORDER BY approx, dni), '') AS dnis,
              COALESCE(string_agg(round(latitude * 100000)::int || ',' || round(longitude * 100000)::int, ',' ORDER BY approx, dni), '') AS coords,
              ${comparing ? `COALESCE(string_agg(mask::text, ',' ORDER BY approx, dni), '')` : "NULL"} AS masks
       FROM (
         SELECT dni, latitude, longitude, ${APPROXIMATE_POINT_SQL} AS approx, (${withMask.mask})::int AS mask FROM padron_unificado
         WHERE ${withMask.where} AND latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY approx, dni LIMIT ${MAP_POINTS_LIMIT}
       ) AS puntos`,
      ...withMask.params
    ),
    getMapStats(filters),
  ]);
  const row = points[0];
  return {
    dnis: row?.dnis ?? "",
    coords: row?.coords ?? "",
    ...(comparing ? { programMask: row?.masks ?? "" } : {}),
    exactCount: row?.exact ?? 0,
    stats,
  };
}

/** Programas que aparecen en el padrón, para el filtro. */
export async function getMapPrograms(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT DISTINCT trim(prog) AS name
     FROM padron_unificado, unnest(string_to_array(COALESCE(programas_activos, ''), '|')) AS prog
     WHERE trim(prog) <> '' ORDER BY 1`
  );
  return rows.map((r) => r.name);
}

function splitPrograms(value: string | null) {
  return Array.from(new Set((value || "").split("|").map((p) => p.trim()).filter(Boolean)));
}

/** Datos para mostrar al tocar un punto (o un grupo de personas en la misma casa). */
export async function getMapPeople(dnis: string[]): Promise<MapPerson[]> {
  const list = Array.from(new Set(dnis.map((d) => String(d).trim()).filter(Boolean))).slice(0, 50);
  if (list.length === 0) return [];
  const rows = await prisma.padronUnificado.findMany({
    where: { dni: { in: list } },
    select: {
      dni: true, nombre_completo: true, direccion: true, barrio: true, localidad: true, telefono: true, programas_activos: true,
      latitude: true, geo_estado: true, geo_fuente: true, direccion_con_altura: true,
    },
    orderBy: [{ nombre_completo: "asc" }, { dni: "asc" }],
  });
  return rows.map((r) => ({
    dni: r.dni,
    nombre: r.nombre_completo || "Sin nombre",
    direccion: r.direccion,
    barrio: r.barrio,
    localidad: r.localidad,
    telefono: r.telefono,
    programas: splitPrograms(r.programas_activos),
    aproximada: isApproximatePoint(r),
  }));
}

export interface MapExportRow {
  name: string;
  dni: string;
  barrio: string;
  address: string;
  programasStr: string;
  latitude: number | string;
  longitude: number | string;
  ubicacion: string;
}

/** Planilla de las personas que se ven en el mapa con los filtros actuales. */
export async function getMapExportRows(filters: MapFilters): Promise<MapExportRow[]> {
  const { where, params } = buildMapWhere(filters);
  const rows = await prisma.$queryRawUnsafe<
    { dni: string; nombre_completo: string | null; barrio: string | null; localidad: string | null; direccion: string | null; programas_activos: string | null; latitude: number; longitude: number; approx: boolean }[]
  >(
    `SELECT dni, nombre_completo, barrio, localidad, direccion, programas_activos, latitude, longitude, ${APPROXIMATE_POINT_SQL} AS approx
     FROM padron_unificado WHERE ${where} AND latitude IS NOT NULL AND longitude IS NOT NULL
     ORDER BY nombre_completo, dni LIMIT ${MAP_POINTS_LIMIT}`,
    ...params
  );
  return rows.map((r) => ({
    name: r.nombre_completo || "Sin nombre",
    dni: r.dni,
    barrio: r.barrio || r.localidad || "No especificado",
    address: r.direccion || "Sin dirección",
    programasStr: splitPrograms(r.programas_activos).join(" | ") || "Ninguno",
    latitude: round5(Number(r.latitude)),
    longitude: round5(Number(r.longitude)),
    ubicacion: r.approx ? "Aproximada (solo barrio)" : "Exacta",
  }));
}
