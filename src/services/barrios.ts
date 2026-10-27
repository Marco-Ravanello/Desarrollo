import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  BARRIOS_3F, barrioOfRow, barrioSlug, canDeleteLugar, canEditLugares, lugarTipoLabel, matchBarrio, parseLugarInput,
  type Barrio3F,
} from "@/lib/barrios";
import { PADRON_PROGRAMS, programSlug } from "@/lib/padron-programs";
import { APPROXIMATE_POINT_SQL, cleanAddressForSearch } from "@/lib/geocoding";
import { georefLookup, osmLookup } from "@/services/geocoding";

// Página de cada barrio: lo que hay en el padrón, en los expedientes, en la emergencia y los lugares de referencia.
// El barrio de una persona es el del padrón: la columna "barrio" si es uno de la lista y, si no, la "localidad"
// (hay planillas que traen el barrio en esa columna). Para no comparar texto fila por fila en la base, se traen
// las combinaciones distintas de barrio y localidad (son pocas), se reconocen acá con matchBarrio y después se
// filtra por esas combinaciones exactas.

type Actor = { id?: string | null; role?: string | null };
export type BarrioScope = { canViewSensitive: boolean };

const SEP = "\u001f";

/** Barrio y localidad de una fila, juntos, para comparar con pairKey. */
const pairSql = Prisma.sql`(COALESCE(p.barrio, '') || chr(31) || COALESCE(p.localidad, ''))`;
const pairKey = (barrio: string, localidad: string) => barrio + SEP + localidad;

type PadronPair = { barrio: string; localidad: string; people: number; withPrograms: number; match: Barrio3F | null };

async function getPadronPairs(): Promise<PadronPair[]> {
  const rows = await prisma.$queryRaw<{ barrio: string; localidad: string; people: bigint; with_programs: bigint }[]>`
    SELECT COALESCE(p.barrio, '') AS barrio, COALESCE(p.localidad, '') AS localidad,
           COUNT(*) AS people, COUNT(*) FILTER (WHERE p.cantidad_programas > 0) AS with_programs
    FROM padron_unificado p
    GROUP BY 1, 2`;
  return rows.map((r) => ({
    barrio: r.barrio,
    localidad: r.localidad,
    people: Number(r.people),
    withPrograms: Number(r.with_programs),
    match: barrioOfRow(r.barrio, r.localidad),
  }));
}

/** Condición SQL (sobre padron_unificado p) para las filas del barrio. */
export async function inBarrioSql(barrio: Barrio3F): Promise<Prisma.Sql> {
  const keys = (await getPadronPairs()).filter((r) => r.match === barrio).map((r) => pairKey(r.barrio, r.localidad));
  return Prisma.sql`${pairSql} = ANY(${keys}::text[])`;
}

/** Expedientes sin cerrar, sin los de Violencia de Género para quien no puede verlos. */
function openCaseFilter(scope: BarrioScope): Prisma.Sql {
  return scope.canViewSensitive
    ? Prisma.sql`c.status <> 'CERRADO'`
    : Prisma.sql`c.status <> 'CERRADO' AND a.name NOT ILIKE '%violencia%'`;
}

/** Las fichas de tormenta de un barrio: se reconocen igual, por el texto que se escribió en la ficha. */
async function stormBarrioValues(): Promise<Map<Barrio3F, string[]>> {
  const rows = await prisma.stormVictimRecord.groupBy({ by: ["barrio"], where: { barrio: { not: null } } });
  const map = new Map<Barrio3F, string[]>();
  for (const r of rows) {
    const b = matchBarrio(r.barrio);
    if (b && r.barrio) map.set(b, [...(map.get(b) ?? []), r.barrio]);
  }
  return map;
}

export type BarrioSummary = {
  barrio: Barrio3F;
  slug: string;
  people: number;
  withPrograms: number;
  openCases: number;
  stormRecords: number;
  lugares: number;
};

export type UnmatchedBarrio = { value: string; total: number };

export const UNMATCHED_SHOWN = 15;

/** Los 29 barrios con sus números, cuántas personas del padrón no tienen un barrio de la lista y cómo están escritos. */
export async function getBarrioSummaries(scope: BarrioScope) {
  const [padron, cases, lugares, stormValues] = await Promise.all([
    getPadronPairs(),
    prisma.$queryRaw<{ barrio: string; localidad: string; total: bigint }[]>`
      SELECT COALESCE(p.barrio, '') AS barrio, COALESCE(p.localidad, '') AS localidad, COUNT(DISTINCT c.id) AS total
      FROM "Case" c
      JOIN "Area" a ON a.id = c."areaId"
      JOIN "Person" pe ON pe.id = c."personId"
      JOIN padron_unificado p ON p.dni = pe.dni
      WHERE ${openCaseFilter(scope)}
      GROUP BY 1, 2`,
    prisma.lugarReferencia.groupBy({ by: ["barrio"], _count: { _all: true } }),
    stormBarrioValues(),
  ]);

  const stormCounts = await prisma.stormVictimRecord.groupBy({
    by: ["barrio"],
    where: { barrio: { in: [...stormValues.values()].flat() } },
    _count: { _all: true },
  });

  const sum = <T,>(rows: T[], value: (r: T) => number) => rows.reduce((a, r) => a + value(r), 0);

  const summaries: BarrioSummary[] = BARRIOS_3F.map((barrio) => ({
    barrio,
    slug: barrioSlug(barrio),
    people: sum(padron.filter((r) => r.match === barrio), (r) => r.people),
    withPrograms: sum(padron.filter((r) => r.match === barrio), (r) => r.withPrograms),
    openCases: sum(cases.filter((r) => barrioOfRow(r.barrio, r.localidad) === barrio), (r) => Number(r.total)),
    stormRecords: sum(stormCounts.filter((r) => matchBarrio(r.barrio) === barrio), (r) => r._count._all),
    lugares: lugares.find((l) => l.barrio === barrio)?._count._all ?? 0,
  }));

  // Lo que no es un barrio de la lista, agrupado por cómo está escrito (el barrio, o la localidad si no hay barrio).
  const outside = padron.filter((r) => !r.match);
  const written = new Map<string, number>();
  for (const r of outside) {
    const value = r.barrio.trim() || r.localidad.trim();
    if (value) written.set(value, (written.get(value) ?? 0) + r.people);
  }
  const unmatched: UnmatchedBarrio[] = [...written.entries()]
    .map(([value, total]) => ({ value, total }))
    .sort((a, b) => b.total - a.total || a.value.localeCompare(b.value, "es"));
  return {
    barrios: summaries,
    totalPeople: sum(padron, (r) => r.people),
    withoutBarrio: sum(outside, (r) => r.people),
    blank: sum(outside.filter((r) => !r.barrio.trim() && !r.localidad.trim()), (r) => r.people),
    unmatched: unmatched.slice(0, UNMATCHED_SHOWN),
    unmatchedKinds: unmatched.length,
  };
}

export type BarrioProgram = { column: string; slug: string; label: string; total: number };
export type BarrioCase = {
  id: string;
  title: string;
  titular: string | null;
  areaName: string;
  priority: string;
  labels: string[];
  createdAt: string;
};

export const BARRIO_CASES_SHOWN = 12;

/** Los números de la página de un barrio. */
export async function getBarrioDetail(barrio: Barrio3F, scope: BarrioScope) {
  const sums = Prisma.join(
    PADRON_PROGRAMS.map((p) => Prisma.sql`COUNT(*) FILTER (WHERE p.${Prisma.raw(`"${p.column}"`)} = 1) AS ${Prisma.raw(`"${p.column}"`)}`),
    ", "
  );
  const inBarrio = await inBarrioSql(barrio);
  const caseFrom = Prisma.sql`
    FROM "Case" c
    JOIN "Area" a ON a.id = c."areaId"
    JOIN "Person" pe ON pe.id = c."personId"
    JOIN padron_unificado p ON p.dni = pe.dni
    WHERE ${openCaseFilter(scope)} AND ${inBarrio}`;

  const stormValues = (await stormBarrioValues()).get(barrio) ?? [];

  const [totals, byLabel, byArea, cases, storm, deliveries, lugares] = await Promise.all([
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT COUNT(*) AS people,
             COUNT(*) FILTER (WHERE p.cantidad_programas > 0) AS with_programs,
             COUNT(*) FILTER (WHERE NULLIF(btrim(p.telefono), '') IS NOT NULL) AS with_phone,
             COUNT(*) FILTER (WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL) AS located,
             ${sums}
      FROM padron_unificado p
      WHERE ${inBarrio}`,
    prisma.$queryRaw<{ label: string | null; total: bigint }[]>`
      SELECT l AS label, COUNT(DISTINCT c.id) AS total
      FROM "Case" c
      JOIN "Area" a ON a.id = c."areaId"
      JOIN "Person" pe ON pe.id = c."personId"
      JOIN padron_unificado p ON p.dni = pe.dni
      LEFT JOIN LATERAL unnest(c.labels) l ON TRUE
      WHERE ${openCaseFilter(scope)} AND ${inBarrio}
      GROUP BY l`,
    prisma.$queryRaw<{ area_id: string; area_name: string; total: bigint }[]>`
      SELECT a.id AS area_id, a.name AS area_name, COUNT(DISTINCT c.id) AS total ${caseFrom}
      GROUP BY a.id, a.name ORDER BY total DESC, a.name ASC`,
    prisma.$queryRaw<{ id: string; title: string; titular: string | null; area_name: string; priority: string; labels: string[]; created_at: Date }[]>`
      SELECT c.id, c.title, COALESCE(p.nombre_completo, pe."lastName" || ', ' || pe."firstName") AS titular,
             a.name AS area_name, c.priority::text AS priority, c.labels, c."createdAt" AS created_at
      ${caseFrom}
      ORDER BY CASE c.priority WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END, c."createdAt" ASC
      LIMIT ${BARRIO_CASES_SHOWN}`,
    stormValues.length
      ? prisma.stormVictimRecord.aggregate({
          where: { barrio: { in: stormValues } },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : Promise.resolve(null),
    stormValues.length
      ? prisma.stormDelivery.aggregate({
          where: { record: { barrio: { in: stormValues } } },
          _count: { _all: true },
          _sum: { colchones: true, camas: true, cuchetas: true, frazadas: true },
          _max: { createdAt: true },
        })
      : Promise.resolve(null),
    prisma.lugarReferencia.findMany({ where: { barrio }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }] }),
  ]);

  const sheets = stormValues.length
    ? await prisma.stormVictimRecord.findMany({
        where: { barrio: { in: stormValues }, sheetId: { not: null } },
        distinct: ["sheetId"],
        select: { sheetId: true },
      })
    : [];

  const t = totals[0] ?? {};
  const programs: BarrioProgram[] = PADRON_PROGRAMS.map((p) => ({
    column: p.column,
    slug: programSlug(p.column),
    label: p.label,
    total: Number(t[p.column] ?? 0),
  }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));

  const openCases = byArea.reduce((a, r) => a + Number(r.total), 0);
  return {
    people: Number(t.people ?? 0),
    withPrograms: Number(t.with_programs ?? 0),
    withPhone: Number(t.with_phone ?? 0),
    located: Number(t.located ?? 0),
    programs,
    openCases,
    casesByLabel: byLabel
      .map((r) => ({ label: r.label, total: Number(r.total) }))
      .sort((a, b) => (a.label === null ? 1 : b.label === null ? -1 : b.total - a.total)),
    casesByArea: byArea.map((r) => ({ areaId: r.area_id, areaName: r.area_name, total: Number(r.total) })),
    cases: cases.map((c) => ({
      id: c.id,
      title: c.title,
      titular: c.titular,
      areaName: c.area_name,
      priority: c.priority,
      labels: c.labels ?? [],
      createdAt: c.created_at.toISOString(),
    })) as BarrioCase[],
    storm: {
      records: storm?._count._all ?? 0,
      lastRecord: storm?._max.createdAt?.toISOString() ?? null,
      operativos: sheets.length,
      deliveries: deliveries?._count._all ?? 0,
      lastDelivery: deliveries?._max.createdAt?.toISOString() ?? null,
      colchones: deliveries?._sum.colchones ?? 0,
      camas: (deliveries?._sum.camas ?? 0) + (deliveries?._sum.cuchetas ?? 0),
      frazadas: deliveries?._sum.frazadas ?? 0,
    },
    lugares,
  };
}

export type BarrioPerson = {
  dni: string;
  nombre: string | null;
  direccion: string | null;
  telefono: string | null;
  programas: number;
};

export const BARRIO_PEOPLE_PAGE = 25;

/** Las personas del padrón que viven en el barrio, por nombre, de a 25. Busca por DNI, nombre o calle. */
export async function getBarrioPeople(barrio: Barrio3F, opts: { q?: string; page?: number } = {}) {
  const q = (opts.q ?? "").slice(0, 80).trim();
  const conditions = [await inBarrioSql(barrio)];
  if (q) {
    const digits = q.replace(/\D/g, "");
    conditions.push(
      /^\d[\d.\s]*$/.test(q) && digits
        ? Prisma.sql`p.dni LIKE ${digits + "%"}`
        : Prisma.sql`(p.nombre_completo ILIKE ${"%" + q + "%"} OR p.direccion ILIKE ${"%" + q + "%"})`
    );
  }
  const where = Prisma.join(conditions, " AND ");
  const countRows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM padron_unificado p WHERE ${where}`;
  const total = Number(countRows[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / BARRIO_PEOPLE_PAGE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1)), pages);
  const people = await prisma.$queryRaw<BarrioPerson[]>`
    SELECT p.dni, p.nombre_completo AS nombre, p.direccion, p.telefono, p.cantidad_programas AS programas
    FROM padron_unificado p
    WHERE ${where}
    ORDER BY p.nombre_completo ASC NULLS LAST, p.dni ASC
    LIMIT ${BARRIO_PEOPLE_PAGE} OFFSET ${(page - 1) * BARRIO_PEOPLE_PAGE}`;
  return { total, page, pages, q, people };
}

// ---------------------------------------------------------------------------
// Lugares de referencia
// ---------------------------------------------------------------------------

type Result = { success: true } | { success: false; error: string };

async function activeActor(user: Actor) {
  if (!user.id) return null;
  return prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, isActive: true } });
}

export async function createLugar(user: Actor, barrio: string, raw: Record<string, unknown>): Promise<Result> {
  const actor = await activeActor(user);
  if (!actor?.isActive || !canEditLugares(actor.role)) return { success: false, error: "Tu rol no puede cargar lugares." };
  const official = BARRIOS_3F.find((b) => b === barrio);
  if (!official) return { success: false, error: "No se encontró el barrio." };
  const parsed = parseLugarInput(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const point = await locateLugar(parsed.data.direccion, official);
  const lugar = await prisma.lugarReferencia.create({
    data: { ...parsed.data, ...point, barrio: official, createdById: actor.id, updatedById: actor.id },
  });
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "LUGAR_CREADO",
      entity: "LugarReferencia",
      entityId: lugar.id,
      details: `${lugarTipoLabel(lugar.tipo)} “${lugar.nombre}” en ${official}.`,
    },
  });
  return { success: true };
}

export async function updateLugar(user: Actor, id: string, raw: Record<string, unknown>): Promise<Result> {
  const actor = await activeActor(user);
  if (!actor?.isActive || !canEditLugares(actor.role)) return { success: false, error: "Tu rol no puede corregir lugares." };
  const before = await prisma.lugarReferencia.findUnique({ where: { id } });
  if (!before) return { success: false, error: "No se encontró el lugar. Puede que lo hayan borrado." };
  const parsed = parseLugarInput(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const after = parsed.data;
  const fields: (keyof typeof after)[] = ["tipo", "nombre", "direccion", "telefono", "contacto", "horario", "notas"];
  const changed = fields.filter((f) => (before[f] ?? null) !== (after[f] ?? null));
  // Si cambió la dirección (o el lugar todavía no tiene punto), se vuelve a buscar en el mapa.
  const relocate = changed.includes("direccion") || (before.latitude === null && Boolean(after.direccion));
  if (!changed.length && !relocate) return { success: true };
  const point = relocate ? await locateLugar(after.direccion, before.barrio) : {};
  await prisma.$transaction([
    prisma.lugarReferencia.update({ where: { id }, data: { ...after, ...point, updatedById: actor.id } }),
    prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "LUGAR_EDITADO",
        entity: "LugarReferencia",
        entityId: id,
        details: changed.length
          ? `“${after.nombre}” en ${before.barrio}: cambió ${changed.map((f) => LUGAR_FIELD_NAMES[f]).join(", ")}.`
          : `“${after.nombre}” en ${before.barrio}: se volvió a buscar en el mapa.`,
      },
    }),
  ]);
  return { success: true };
}

const LUGAR_FIELD_NAMES: Record<string, string> = {
  tipo: "tipo",
  nombre: "nombre",
  direccion: "dirección",
  telefono: "teléfono",
  contacto: "contacto",
  horario: "horario",
  notas: "notas",
};

export async function deleteLugar(user: Actor, id: string): Promise<Result> {
  const actor = await activeActor(user);
  const lugar = await prisma.lugarReferencia.findUnique({ where: { id } });
  if (!lugar) return { success: true };
  if (!actor?.isActive || !canDeleteLugar(actor, lugar.createdById)) {
    return { success: false, error: "Un lugar lo borra quien lo cargó o la conducción." };
  }
  await prisma.$transaction([
    prisma.lugarReferencia.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "LUGAR_BORRADO",
        entity: "LugarReferencia",
        entityId: id,
        details: `${lugarTipoLabel(lugar.tipo)} “${lugar.nombre}” en ${lugar.barrio}.`,
      },
    }),
  ]);
  return { success: true };
}

/**
 * Busca la dirección de un lugar en el mapa (Georef y, si no, OpenStreetMap), dentro del partido. Si no la
 * encuentra o los servicios no responden, el lugar queda sin punto: se guarda igual y se avisa en el mapa del barrio.
 */
async function locateLugar(direccion: string | null, barrio: string): Promise<{ latitude: number | null; longitude: number | null }> {
  const none = { latitude: null, longitude: null };
  const address = cleanAddressForSearch(direccion);
  if (!address) return none;
  try {
    const [georef] = await georefLookup([address]);
    const point = georef ?? (await osmLookup(address, null, barrio));
    return point ? { latitude: point.lat, longitude: point.lon } : none;
  } catch (err) {
    console.error("No se pudo ubicar el lugar de referencia:", err);
    return none;
  }
}

// ---------------------------------------------------------------------------
// Mapa del barrio
// ---------------------------------------------------------------------------

/** Tope de personas en el mapa de un barrio (el más grande tiene unas 8.000). */
export const BARRIO_MAP_LIMIT = 20000;

export type BarrioMapCase = { id: string; title: string; titular: string | null; area: string; priority: string; lat: number; lng: number };
export type BarrioMapLugar = { id: string; tipo: string; nombre: string; direccion: string | null; lat: number; lng: number };

export type BarrioMapData = {
  /** Personas: [lat, lng, 1 si el punto es aproximado (solo barrio) o 0] por persona, en el orden de `dnis`. */
  points: number[];
  dnis: string[];
  cases: BarrioMapCase[];
  lugares: BarrioMapLugar[];
  /** Lugares de referencia con dirección que no se encontraron en el mapa. */
  lugaresSinPunto: number;
  /** Personas del barrio sin punto en el mapa. */
  sinPunto: number;
};

/** Lo que se dibuja en el mapa de un barrio: su gente, sus expedientes abiertos y sus lugares de referencia. */
export async function getBarrioMapData(barrio: Barrio3F, scope: BarrioScope): Promise<BarrioMapData> {
  const inBarrio = await inBarrioSql(barrio);
  const [people, missing, cases, lugares] = await Promise.all([
    prisma.$queryRaw<{ dni: string; lat: number; lng: number; approx: boolean }[]>`
      SELECT p.dni, p.latitude AS lat, p.longitude AS lng, ${Prisma.raw(APPROXIMATE_POINT_SQL)} AS approx
      FROM padron_unificado p
      WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND ${inBarrio}
      LIMIT ${BARRIO_MAP_LIMIT}`,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total FROM padron_unificado p WHERE (p.latitude IS NULL OR p.longitude IS NULL) AND ${inBarrio}`,
    prisma.$queryRaw<{ id: string; title: string; titular: string | null; area: string; priority: string; lat: number; lng: number }[]>`
      SELECT c.id, c.title, p.nombre_completo AS titular, a.name AS area, c.priority::text AS priority, p.latitude AS lat, p.longitude AS lng
      FROM "Case" c
      JOIN "Area" a ON a.id = c."areaId"
      JOIN "Person" pe ON pe.id = c."personId"
      JOIN padron_unificado p ON p.dni = pe.dni
      WHERE ${openCaseFilter(scope)} AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND ${inBarrio}
      ORDER BY c."createdAt" ASC
      LIMIT 2000`,
    prisma.lugarReferencia.findMany({ where: { barrio }, select: { id: true, tipo: true, nombre: true, direccion: true, latitude: true, longitude: true } }),
  ]);
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    points: people.flatMap((p) => [round(p.lat), round(p.lng), p.approx ? 1 : 0]),
    dnis: people.map((p) => p.dni),
    cases,
    lugares: lugares
      .filter((l) => l.latitude !== null && l.longitude !== null)
      .map((l) => ({ id: l.id, tipo: l.tipo, nombre: l.nombre, direccion: l.direccion, lat: l.latitude!, lng: l.longitude! })),
    lugaresSinPunto: lugares.filter((l) => l.latitude === null && l.direccion).length,
    sinPunto: Number(missing[0]?.total ?? 0),
  };
}
