import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  PADRON_PROGRAMS, findPadronProgram, isPadronProgramColumn, programSlug, type PadronProgramColumn,
} from "@/lib/padron-programs";
import { canAssignProgramArea, canManageProgram } from "@/lib/program-ownership";

// Página de cada programa del padrón (cuántas personas tiene, dónde están, altas y bajas) y qué área
// lo tiene a cargo. Las personas de un programa son las que tienen su columna prog_... en 1, igual que
// en Cruces de programas y en el Mapa Social.

type Actor = { id?: string | null; role?: string | null };

export type ProgramOwner = { areaId: string; areaName: string };

/** Qué área tiene a cargo cada programa (los que no tienen área no aparecen). */
export async function getProgramOwners(): Promise<Map<PadronProgramColumn, ProgramOwner>> {
  const rows = await prisma.programaArea.findMany({
    where: { areaId: { not: null } },
    select: { programa: true, area: { select: { id: true, name: true } } },
  });
  const owners = new Map<PadronProgramColumn, ProgramOwner>();
  for (const r of rows) {
    if (r.area && isPadronProgramColumn(r.programa)) owners.set(r.programa, { areaId: r.area.id, areaName: r.area.name });
  }
  return owners;
}

/** El área del usuario según la base (no la de la sesión, que puede tener unos minutos de atraso). */
async function viewerFromDb(user: Actor) {
  if (!user.id) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, areaId: true } });
  return dbUser ? { role: dbUser.role, areaId: dbUser.areaId } : null;
}

/**
 * Null si puede dar altas y bajas en el programa; si no, el mensaje para mostrar.
 * La usan las altas y bajas desde la ficha.
 */
export async function programManageError(user: Actor, column: PadronProgramColumn): Promise<string | null> {
  const viewer = await viewerFromDb(user);
  if (!viewer) return "Tu sesión expiró. Volvé a iniciar sesión.";
  const owner = await prisma.programaArea.findUnique({ where: { programa: column }, select: { area: { select: { id: true, name: true } } } });
  if (canManageProgram(viewer, owner?.area?.id)) return null;
  if (!owner?.area) return "Tu rol no puede dar altas ni bajas en los programas.";
  return `${findPadronProgram(column)!.label} está a cargo de ${owner.area.name}. Las altas y bajas las da esa área o la conducción.`;
}

/** Elige qué área tiene a cargo el programa (o ninguna). Solo la conducción. Queda en Auditoría. */
export async function setProgramArea(user: Actor, column: string, areaId: string | null) {
  if (!user.id || !canAssignProgramArea(user.role)) {
    return { success: false as const, error: "Solo la conducción elige qué área tiene a cargo cada programa." };
  }
  if (!isPadronProgramColumn(column)) return { success: false as const, error: "No se encontró el programa." };
  const program = findPadronProgram(column)!;
  const area = areaId ? await prisma.area.findUnique({ where: { id: areaId }, select: { id: true, name: true } }) : null;
  if (areaId && !area) return { success: false as const, error: "No se encontró el área." };

  const before = await prisma.programaArea.findUnique({ where: { programa: column }, select: { area: { select: { id: true, name: true } } } });
  if ((before?.area?.id ?? null) === (area?.id ?? null)) return { success: true as const };

  await prisma.$transaction([
    prisma.programaArea.upsert({
      where: { programa: column },
      create: { programa: column, areaId: area?.id ?? null, updatedById: user.id },
      update: { areaId: area?.id ?? null, updatedById: user.id },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PROGRAMA_AREA",
        entity: "Programa",
        entityId: column,
        details: `${program.label}: ${area ? `a cargo de ${area.name}` : "sin área a cargo"} (antes: ${before?.area?.name ?? "sin área"}).`,
      },
    }),
  ]);
  return { success: true as const };
}

const col = (column: PadronProgramColumn) => Prisma.raw(`"${column}"`);

/** Primer día del mes, en UTC, `back` meses antes del mes de `from`. */
function monthStart(from: Date, back: number): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - back, 1));
}

export type ProgramSummary = {
  column: PadronProgramColumn;
  slug: string;
  label: string;
  people: number;
  owner: ProgramOwner | null;
  altas: number;
  bajas: number;
};

/** Todos los programas con cuántas personas tienen hoy, su área a cargo y las altas y bajas de los últimos 30 días. */
export async function getProgramSummaries(now = new Date()): Promise<ProgramSummary[]> {
  const sums = Prisma.join(
    PADRON_PROGRAMS.map((p) => Prisma.sql`COUNT(*) FILTER (WHERE ${col(p.column)} = 1) AS ${Prisma.raw(`"${p.column}"`)}`),
    ", "
  );
  const since = new Date(now.getTime() - 30 * 86400000);
  const [countRows, moves, owners] = await Promise.all([
    prisma.$queryRaw<Record<string, bigint>[]>`SELECT ${sums} FROM padron_unificado`,
    prisma.$queryRaw<{ programa: string; tipo: string; total: bigint }[]>`
      SELECT programa, tipo, COUNT(*) AS total FROM padron_movimientos WHERE fecha >= ${since} GROUP BY programa, tipo`,
    getProgramOwners(),
  ]);
  const counts = countRows[0] ?? {};
  const moveCount = (column: string, tipo: string) => Number(moves.find((m) => m.programa === column && m.tipo === tipo)?.total ?? 0);
  return PADRON_PROGRAMS.map((p) => ({
    column: p.column,
    slug: programSlug(p.column),
    label: p.label,
    people: Number(counts[p.column] ?? 0),
    owner: owners.get(p.column) ?? null,
    altas: moveCount(p.column, "ALTA"),
    bajas: moveCount(p.column, "BAJA"),
  }));
}

export type ProgramMonth = { month: string; altas: number; bajas: number };
export type ProgramDetail = {
  people: number;
  withPhone: number;
  barrios: { barrio: string | null; total: number }[];
  barrioCount: number;
  months: ProgramMonth[];
  altas12: number;
  bajas12: number;
  reasons: { motivo: string; total: number }[];
};

const BARRIOS_SHOWN = 10;

/** Los números de la página de un programa: personas, barrios, altas y bajas de los últimos 12 meses y motivos de baja. */
export async function getProgramDetail(column: PadronProgramColumn, now = new Date()): Promise<ProgramDetail> {
  const from = monthStart(now, 11);
  const [totals, barrios, moves, reasons] = await Promise.all([
    prisma.$queryRaw<{ people: bigint; with_phone: bigint; barrios: bigint }[]>`
      SELECT COUNT(*) AS people,
             COUNT(*) FILTER (WHERE NULLIF(TRIM(telefono), '') IS NOT NULL) AS with_phone,
             COUNT(DISTINCT NULLIF(TRIM(barrio), '')) AS barrios
      FROM padron_unificado WHERE ${col(column)} = 1`,
    prisma.$queryRaw<{ barrio: string | null; total: bigint }[]>`
      SELECT NULLIF(TRIM(barrio), '') AS barrio, COUNT(*) AS total
      FROM padron_unificado WHERE ${col(column)} = 1
      GROUP BY 1 ORDER BY total DESC, barrio ASC LIMIT ${BARRIOS_SHOWN + 1}`,
    prisma.$queryRaw<{ month: string; tipo: string; total: bigint }[]>`
      SELECT to_char(fecha, 'YYYY-MM') AS month, tipo, COUNT(*) AS total
      FROM padron_movimientos WHERE programa = ${column} AND fecha >= ${from}
      GROUP BY 1, 2`,
    // Los motivos se agrupan sin importar mayúsculas ni espacios; se muestra cómo se escribió la última vez.
    prisma.$queryRaw<{ motivo: string; total: bigint }[]>`
      SELECT (ARRAY_AGG(TRIM(motivo) ORDER BY "createdAt" DESC))[1] AS motivo, COUNT(*) AS total
      FROM padron_movimientos
      WHERE programa = ${column} AND tipo = 'BAJA' AND NULLIF(TRIM(motivo), '') IS NOT NULL
      GROUP BY LOWER(TRIM(motivo)) ORDER BY total DESC, motivo ASC LIMIT 6`,
  ]);

  const months: ProgramMonth[] = Array.from({ length: 12 }, (_, i) => {
    const key = monthStart(now, 11 - i).toISOString().slice(0, 7);
    const count = (tipo: string) => Number(moves.find((m) => m.month === key && m.tipo === tipo)?.total ?? 0);
    return { month: key, altas: count("ALTA"), bajas: count("BAJA") };
  });
  const t = totals[0];
  return {
    people: Number(t?.people ?? 0),
    withPhone: Number(t?.with_phone ?? 0),
    barrioCount: Number(t?.barrios ?? 0),
    barrios: barrios.map((b) => ({ barrio: b.barrio, total: Number(b.total) })),
    months,
    altas12: months.reduce((a, m) => a + m.altas, 0),
    bajas12: months.reduce((a, m) => a + m.bajas, 0),
    reasons: reasons.map((r) => ({ motivo: r.motivo, total: Number(r.total) })),
  };
}

export type ProgramPerson = {
  dni: string;
  nombre: string | null;
  barrio: string | null;
  localidad: string | null;
  telefono: string | null;
  /** Fecha de su última alta registrada (las del padrón original no tienen). */
  desde: string | null;
};

export const PROGRAM_PEOPLE_PAGE = 25;

function peopleWhere(column: PadronProgramColumn, q: string): Prisma.Sql {
  const conditions = [Prisma.sql`p.${col(column)} = 1`];
  const text = q.trim();
  if (text) {
    const digits = text.replace(/\D/g, "");
    conditions.push(
      /^\d[\d.\s]*$/.test(text) && digits
        ? Prisma.sql`p.dni LIKE ${digits + "%"}`
        : Prisma.sql`(p.nombre_completo ILIKE ${"%" + text + "%"} OR p.barrio ILIKE ${"%" + text + "%"})`
    );
  }
  return Prisma.join(conditions, " AND ");
}

/** Las personas del programa, por nombre, de a 25. Busca por DNI, nombre o barrio. */
export async function getProgramPeople(column: PadronProgramColumn, opts: { q?: string; page?: number } = {}) {
  const q = (opts.q ?? "").slice(0, 80);
  const where = peopleWhere(column, q);
  const countRows = await prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM padron_unificado p WHERE ${where}`;
  const total = Number(countRows[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PROGRAM_PEOPLE_PAGE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1)), pages);
  const rows = await prisma.$queryRaw<(Omit<ProgramPerson, "desde"> & { desde: Date | null })[]>`
    SELECT p.dni, p.nombre_completo AS nombre, p.barrio, p.localidad, p.telefono, m.fecha AS desde
    FROM padron_unificado p
    LEFT JOIN LATERAL (
      SELECT fecha FROM padron_movimientos
      WHERE dni = p.dni AND programa = ${column} AND tipo = 'ALTA'
      ORDER BY fecha DESC, "createdAt" DESC LIMIT 1
    ) m ON TRUE
    WHERE ${where}
    ORDER BY p.nombre_completo ASC NULLS LAST, p.dni ASC
    LIMIT ${PROGRAM_PEOPLE_PAGE} OFFSET ${(page - 1) * PROGRAM_PEOPLE_PAGE}`;
  return {
    total,
    page,
    pages,
    q,
    people: rows.map((r) => ({ ...r, desde: r.desde ? r.desde.toISOString() : null })) as ProgramPerson[],
  };
}

/** Todas las personas del programa para bajar la lista (con un tope, por las dudas). */
export async function getProgramPeopleForExport(column: PadronProgramColumn, limit = 100000) {
  return prisma.$queryRaw<
    { dni: string; nombre_completo: string | null; direccion: string | null; barrio: string | null; localidad: string | null; telefono: string | null; email: string | null; desde: Date | null }[]
  >`
    SELECT p.dni, p.nombre_completo, p.direccion, p.barrio, p.localidad, p.telefono, p.email, m.fecha AS desde
    FROM padron_unificado p
    LEFT JOIN LATERAL (
      SELECT fecha FROM padron_movimientos
      WHERE dni = p.dni AND programa = ${column} AND tipo = 'ALTA'
      ORDER BY fecha DESC, "createdAt" DESC LIMIT 1
    ) m ON TRUE
    WHERE p.${col(column)} = 1
    ORDER BY p.nombre_completo ASC NULLS LAST, p.dni ASC
    LIMIT ${limit}`;
}
