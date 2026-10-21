import prisma from "@/lib/prisma";
import { buildMapWhere, type MapFilters } from "@/lib/map-filters";
import { getCaseStatusConfig } from "@/lib/status-styles";
import { DELIVERY_STATUS_LABEL, cleanItemQuantities, deliveryStatus } from "@/lib/emergency-categories";
import { deliveryTotals } from "@/services/emergency";
import { isDeliveryTableReady } from "@/services/emergency-db-status";
import type { StormVictimItem } from "@/types/emergency";
import { MAP_POINTS_LIMIT } from "@/services/map";

// Capas que se suman al Mapa Social: expedientes abiertos y fichas de emergencia climática.
// Cada una se ubica en la dirección de la persona (la del padrón, si tiene punto; si no, la de su legajo)
// y se filtra con los mismos filtros del mapa. Al navegador viajan solo los ids y las coordenadas.

export type MapLayerKey = "cases" | "storm";
export const MAP_LAYER_KEYS: MapLayerKey[] = ["cases", "storm"];

export interface MapLayerPoints {
  /** Id de cada punto (expediente o ficha), en el mismo orden que `coords`. */
  ids: string[];
  /** Coordenadas planas: [lat0, lon0, lat1, lon1, ...]. */
  coords: number[];
  /** Cuántos hay con estos filtros, tengan o no punto en el mapa. */
  total: number;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** El punto sale del padrón si lo tiene; si no, del legajo de la persona. Siempre lat y lon de la misma fuente. */
const PADRON_HAS_POINT = "pu.latitude IS NOT NULL AND pu.longitude IS NOT NULL";
const POINT_COLUMNS = `
  CASE WHEN ${PADRON_HAS_POINT} THEN pu.latitude ELSE p.latitude END AS latitude,
  CASE WHEN ${PADRON_HAS_POINT} THEN pu.longitude ELSE p.longitude END AS longitude`;

/**
 * Filas con las mismas columnas que padron_unificado, para reusar los filtros del mapa.
 * Sin permiso para Violencia de Género, esos expedientes no se cuentan ni se dibujan.
 */
function layerSource(layer: MapLayerKey, canViewSensitive: boolean): string {
  if (layer === "cases") {
    return `
      SELECT c.id AS item_id,
        COALESCE(pu.dni, p.dni) AS dni,
        COALESCE(pu.nombre_completo, concat_ws(', ', p."lastName", p."firstName")) AS nombre_completo,
        COALESCE(pu.direccion, p.address) AS direccion,
        pu.barrio, pu.localidad, pu.programas_activos,
        ${POINT_COLUMNS}
      FROM "Case" c
      JOIN "Area" a ON a.id = c."areaId"
      LEFT JOIN "Person" p ON p.id = c."personId"
      LEFT JOIN padron_unificado pu ON pu.dni = p.dni
      WHERE c.status <> 'CERRADO'${canViewSensitive ? "" : ` AND a.name !~* 'violencia'`}`;
  }
  return `
    SELECT r.id AS item_id,
      COALESCE(pu.dni, NULLIF(trim(r.dni), ''), p.dni) AS dni,
      COALESCE(pu.nombre_completo, r."nombreApellido") AS nombre_completo,
      COALESCE(pu.direccion, r.domicilio) AS direccion,
      COALESCE(NULLIF(trim(r.barrio), ''), pu.barrio) AS barrio, pu.localidad, pu.programas_activos,
      ${POINT_COLUMNS}
    FROM "StormVictimRecord" r
    LEFT JOIN "Person" p ON p.id = r."personId"
    LEFT JOIN padron_unificado pu ON pu.dni = COALESCE(NULLIF(trim(r.dni), ''), p.dni)`;
}

export async function getMapLayer(layer: MapLayerKey, filters: MapFilters, canViewSensitive: boolean): Promise<MapLayerPoints> {
  const { where, params } = buildMapWhere(filters);
  const source = `WITH pts AS (${layerSource(layer, canViewSensitive)})`;
  const [points, totals] = await Promise.all([
    prisma.$queryRawUnsafe<{ item_id: string; latitude: number; longitude: number }[]>(
      `${source} SELECT item_id, latitude, longitude FROM pts
       WHERE ${where} AND latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY item_id LIMIT ${MAP_POINTS_LIMIT}`,
      ...params
    ),
    prisma.$queryRawUnsafe<{ total: number }[]>(`${source} SELECT COUNT(*)::int AS total FROM pts WHERE ${where}`, ...params),
  ]);
  const ids: string[] = new Array(points.length);
  const coords: number[] = new Array(points.length * 2);
  points.forEach((p, i) => {
    ids[i] = p.item_id;
    coords[i * 2] = round5(Number(p.latitude));
    coords[i * 2 + 1] = round5(Number(p.longitude));
  });
  return { ids, coords, total: totals[0]?.total ?? 0 };
}

export interface MapCaseItem {
  id: string;
  title: string;
  status: string;
  area: string;
  titular: string | null;
  dni: string | null;
}

export interface MapStormItem {
  id: string;
  nombre: string;
  dni: string | null;
  domicilio: string;
  barrio: string | null;
  fecha: string;
  entrega: string;
}

const MAX_DETAILS = 50;
const cleanIds = (ids: string[]) => Array.from(new Set((Array.isArray(ids) ? ids : []).map((d) => String(d).trim()).filter(Boolean))).slice(0, MAX_DETAILS);

/** Datos para mostrar al tocar un expediente en el mapa. */
export async function getMapCaseItems(ids: string[], canViewSensitive: boolean): Promise<MapCaseItem[]> {
  const list = cleanIds(ids);
  if (list.length === 0) return [];
  const rows = await prisma.case.findMany({
    where: {
      id: { in: list },
      status: { not: "CERRADO" },
      ...(canViewSensitive ? {} : { NOT: { area: { name: { contains: "violencia", mode: "insensitive" } } } }),
    },
    select: { id: true, title: true, status: true, area: { select: { name: true } }, person: { select: { firstName: true, lastName: true, dni: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    status: getCaseStatusConfig(c.status).label,
    area: c.area.name,
    titular: c.person ? `${c.person.lastName}, ${c.person.firstName}` : null,
    dni: c.person?.dni ?? null,
  }));
}

/** Datos para mostrar al tocar una ficha de emergencia en el mapa. */
export async function getMapStormItems(ids: string[]): Promise<MapStormItem[]> {
  const list = cleanIds(ids);
  if (list.length === 0) return [];
  const withDeliveries = await isDeliveryTableReady();
  const rows = await prisma.stormVictimRecord.findMany({
    where: { id: { in: list } },
    select: {
      id: true, nombreApellido: true, dni: true, domicilio: true, barrio: true, createdAt: true, otrosElementos: true,
      requiereColchon: true, cantidadColchon: true, requiereCama: true, cantidadCama: true,
      requiereCucheta: true, cantidadCucheta: true, requiereFrazada: true, cantidadFrazada: true,
      sheet: { select: { date: true } },
      ...(withDeliveries ? { entregas: true } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(({ entregas, sheet, ...r }: any) => {
    const item = { ...r, otrosElementos: cleanItemQuantities(r.otrosElementos), ...deliveryTotals(entregas) } as StormVictimItem;
    return {
      id: r.id,
      nombre: r.nombreApellido,
      dni: r.dni?.trim() || null,
      domicilio: r.domicilio,
      barrio: r.barrio?.trim() || null,
      fecha: new Date(sheet?.date ?? r.createdAt).toISOString(),
      entrega: DELIVERY_STATUS_LABEL[deliveryStatus(item)],
    };
  });
}
