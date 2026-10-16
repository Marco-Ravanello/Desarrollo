import prisma from "@/lib/prisma";
import { buildMapWhere, type MapFilters } from "@/lib/map-filters";
import { APPROXIMATE_POINT_SQL, isApproximatePoint } from "@/lib/geocoding";

// Datos del Mapa Social. Al navegador viajan solo los puntos (DNI y coordenadas);
// el nombre, la dirección y los programas se piden al tocar un punto.

/** Tope de seguridad: alcanza para todo el padrón actual con margen. */
export const MAP_POINTS_LIMIT = 200000;

export interface MapStats {
  /** Personas del padrón que cumplen los filtros (tengan o no punto). */
  total: number;
  /** De esas, cuántas tienen un punto en el mapa. */
  located: number;
  /** De las ubicadas, cuántas tienen un punto aproximado (la dirección solo tiene el barrio). */
  approximate: number;
  topBarrio: string;
  topProgram: string;
}

export interface MapData {
  /** DNI de cada punto, en el mismo orden que `coords`. Primero los exactos, después los aproximados. */
  dnis: string[];
  /** Los primeros `exactCount` puntos son exactos; el resto, aproximados (solo barrio). */
  exactCount: number;
  /** Coordenadas planas: [lat0, lon0, lat1, lon1, ...] (5 decimales, ~1 m). */
  coords: number[];
  stats: MapStats;
}

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

export async function getMapData(filters: MapFilters): Promise<MapData> {
  const { where, params } = buildMapWhere(filters);
  const located = `${where} AND latitude IS NOT NULL AND longitude IS NOT NULL`;
  const [points, totals, barrios, programs] = await Promise.all([
    prisma.$queryRawUnsafe<{ dni: string; latitude: number; longitude: number; approx: boolean }[]>(
      `SELECT dni, latitude, longitude, ${APPROXIMATE_POINT_SQL} AS approx FROM padron_unificado
       WHERE ${located} ORDER BY approx, dni LIMIT ${MAP_POINTS_LIMIT}`,
      ...params
    ),
    prisma.$queryRawUnsafe<{ total: number }[]>(`SELECT COUNT(*)::int AS total FROM padron_unificado WHERE ${where}`, ...params),
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

  const dnis: string[] = new Array(points.length);
  const coords: number[] = new Array(points.length * 2);
  let exactCount = 0;
  points.forEach((p, i) => {
    if (!p.approx) exactCount++;
    dnis[i] = p.dni;
    coords[i * 2] = round5(Number(p.latitude));
    coords[i * 2 + 1] = round5(Number(p.longitude));
  });

  return {
    dnis,
    exactCount,
    coords,
    stats: {
      total: totals[0]?.total ?? 0,
      located: points.length,
      approximate: points.length - exactCount,
      topBarrio: barrios[0]?.name || "Sin datos",
      topProgram: programs[0]?.name || "Sin datos",
    },
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
