import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findPadronProgram, isPadronProgramColumn, type PadronProgramColumn } from "@/lib/padron-programs";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { canManageProgram } from "@/lib/program-ownership";
import {
  hasCheckableRequirements, parseRequirementsInput, requirementsFromRow, requirementsSummary, type ProgramRequirements,
} from "@/lib/program-requirements";
import { inBarriosSql } from "@/services/barrios";

// Posibles destinatarios de un programa: las personas del padrón que cumplen sus requisitos simples
// (edad, barrio, etiquetas de expedientes abiertos y otros programas) y todavía no están en él.
// La edad sale de la fecha de nacimiento del padrón, si no de la del Registro Único y si no de la
// edad aproximada; a quien no tiene ninguna no se lo puede revisar por edad, y se cuenta aparte.

type Actor = { id?: string | null; role?: string | null };
export type CandidateScope = { canViewSensitive: boolean };

export async function getProgramRequirements(column: PadronProgramColumn): Promise<ProgramRequirements> {
  const row = await prisma.programaRequisitos.findUnique({ where: { programa: column } });
  return requirementsFromRow(column, row);
}

/** Guarda los requisitos del programa. Los cambia quien da altas en él (su área o la conducción). Queda en Auditoría. */
export async function saveProgramRequirements(user: Actor, column: string, raw: Record<string, unknown>) {
  if (!user.id) return { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!isPadronProgramColumn(column)) return { success: false as const, error: "No se encontró el programa." };
  const program = findPadronProgram(column)!;
  const [dbUser, owner] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { role: true, areaId: true } }),
    prisma.programaArea.findUnique({ where: { programa: column }, select: { area: { select: { id: true, name: true } } } }),
  ]);
  if (!dbUser || !canManageProgram(dbUser, owner?.area?.id)) {
    return {
      success: false as const,
      error: owner?.area
        ? `${program.label} está a cargo de ${owner.area.name}. Los requisitos los cambia esa área o la conducción.`
        : "Tu rol no puede cambiar los requisitos de los programas.",
    };
  }
  const parsed = parseRequirementsInput(column, raw);
  if (!parsed.ok) return { success: false as const, error: parsed.error };
  const data = parsed.data;

  await prisma.$transaction([
    prisma.programaRequisitos.upsert({
      where: { programa: column },
      create: { programa: column, ...data, updatedById: user.id },
      update: { ...data, updatedById: user.id },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PROGRAMA_REQUISITOS",
        entity: "Programa",
        entityId: column,
        details: `Requisitos de ${program.label}: ${requirementsSummary(data)}`,
      },
    }),
  ]);
  return { success: true as const };
}

const col = (column: string) => Prisma.raw(`"${column}"`);

/**
 * La edad de cada fila (en años, o null). Las fechas del padrón vienen como texto (dd/mm/aaaa o aaaa-mm-dd);
 * se separan en números sin armar una fecha, así una fecha mal escrita no rompe la consulta.
 */
function ageJoins(today: string): Prisma.Sql {
  const [cy, cm, cd] = today.split("-").map(Number);
  return Prisma.sql`
    LEFT JOIN "Person" pe ON pe.dni = p.dni
    LEFT JOIN LATERAL (
      SELECT regexp_match(COALESCE(p.fecha_nacimiento, ''), '^ *([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4})') AS a,
             regexp_match(COALESCE(p.fecha_nacimiento, ''), '^ *([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})') AS b,
             regexp_replace(COALESCE(p.edad_aprox, ''), '[^0-9]', '', 'g') AS aprox
    ) f ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(CASE WHEN f.a IS NOT NULL THEN f.a[3]::int WHEN f.b IS NOT NULL THEN f.b[1]::int END,
                      EXTRACT(YEAR FROM pe."birthDate" AT TIME ZONE 'UTC')::int) AS y,
             COALESCE(CASE WHEN f.a IS NOT NULL THEN f.a[2]::int WHEN f.b IS NOT NULL THEN f.b[2]::int END,
                      EXTRACT(MONTH FROM pe."birthDate" AT TIME ZONE 'UTC')::int) AS m,
             COALESCE(CASE WHEN f.a IS NOT NULL THEN f.a[1]::int WHEN f.b IS NOT NULL THEN f.b[3]::int END,
                      EXTRACT(DAY FROM pe."birthDate" AT TIME ZONE 'UTC')::int) AS d
    ) n ON TRUE
    LEFT JOIN LATERAL (
      SELECT CASE WHEN n.y IS NOT NULL AND n.m BETWEEN 1 AND 12 AND n.d BETWEEN 1 AND 31
                  THEN ${cy}::int - n.y - CASE WHEN ${cm}::int < n.m OR (${cm}::int = n.m AND ${cd}::int < n.d) THEN 1 ELSE 0 END
             END AS by_date
    ) e ON TRUE
    LEFT JOIN LATERAL (
      SELECT CASE WHEN e.by_date BETWEEN 0 AND 119 THEN e.by_date
                  WHEN f.aprox ~ '^[0-9]{1,3}$' AND f.aprox::int < 120 THEN f.aprox::int
             END AS edad
    ) age ON TRUE`;
}

/** Todas las condiciones menos la edad (para contar aparte a quienes no tienen edad cargada). */
async function baseConditions(column: PadronProgramColumn, r: ProgramRequirements, scope: CandidateScope): Promise<Prisma.Sql[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`p.${col(column)} = 0`];
  if (r.barrios.length) conditions.push(await inBarriosSql(r.barrios));
  if (r.enProgramas.length) conditions.push(Prisma.sql`(${Prisma.join(r.enProgramas.map((c) => Prisma.sql`p.${col(c)} = 1`), " OR ")})`);
  for (const c of r.sinProgramas) conditions.push(Prisma.sql`p.${col(c)} = 0`);
  if (r.etiquetas.length) {
    // Los de Violencia de Género solo cuentan para quien puede verlos.
    const sensitive = scope.canViewSensitive ? Prisma.empty : Prisma.sql`AND a.name NOT ILIKE '%violencia%'`;
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Case" c
      JOIN "Person" cp ON cp.id = c."personId"
      JOIN "Area" a ON a.id = c."areaId"
      WHERE cp.dni = p.dni AND c.status <> 'CERRADO' AND c.labels && ${r.etiquetas}::text[] ${sensitive}
    )`);
  }
  return conditions;
}

function ageCondition(r: ProgramRequirements): Prisma.Sql | null {
  if (r.edadMin === null && r.edadMax === null) return null;
  const parts = [Prisma.sql`age.edad IS NOT NULL`];
  if (r.edadMin !== null) parts.push(Prisma.sql`age.edad >= ${r.edadMin}`);
  if (r.edadMax !== null) parts.push(Prisma.sql`age.edad <= ${r.edadMax}`);
  return Prisma.join(parts, " AND ");
}

function searchCondition(q: string): Prisma.Sql | null {
  const text = q.trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return /^\d[\d.\s]*$/.test(text) && digits
    ? Prisma.sql`p.dni LIKE ${digits + "%"}`
    : Prisma.sql`(p.nombre_completo ILIKE ${"%" + text + "%"} OR p.barrio ILIKE ${"%" + text + "%"})`;
}

export type CandidateCounts = {
  /** Cumplen todo y no están en el programa. */
  total: number;
  /** Cumplen todo lo demás, pero no tienen edad cargada: no se los pudo revisar por edad. */
  withoutAge: number;
};

/** Cuántos cumplen los requisitos. Si el programa no tiene requisitos que se puedan revisar, cero. */
export async function countProgramCandidates(
  column: PadronProgramColumn,
  r: ProgramRequirements,
  scope: CandidateScope,
  now = new Date()
): Promise<CandidateCounts> {
  if (!hasCheckableRequirements(r)) return { total: 0, withoutAge: 0 };
  const base = Prisma.join(await baseConditions(column, r, scope), " AND ");
  const age = ageCondition(r);
  const rows = await prisma.$queryRaw<{ total: bigint; without_age: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE ${age ?? Prisma.sql`TRUE`}) AS total,
           COUNT(*) FILTER (WHERE ${age ? Prisma.sql`age.edad IS NULL` : Prisma.sql`FALSE`}) AS without_age
    FROM padron_unificado p ${ageJoins(todayInArgentina(now))}
    WHERE ${base}`;
  return { total: Number(rows[0]?.total ?? 0), withoutAge: Number(rows[0]?.without_age ?? 0) };
}

export type ProgramCandidate = {
  dni: string;
  nombre: string | null;
  edad: number | null;
  barrio: string | null;
  telefono: string | null;
  /** Si antes estuvo en el programa: el día de su última baja (AAAA-MM-DD). */
  ultimaBaja: string | null;
};

export const CANDIDATES_PAGE = 25;

/** La lista de posibles destinatarios, por apellido, de a 25. Busca por DNI, nombre o barrio. */
export async function getProgramCandidates(
  column: PadronProgramColumn,
  r: ProgramRequirements,
  scope: CandidateScope,
  opts: { q?: string; page?: number } = {},
  now = new Date()
) {
  const q = (opts.q ?? "").slice(0, 80);
  if (!hasCheckableRequirements(r)) return { total: 0, page: 1, pages: 1, q, people: [] as ProgramCandidate[] };
  const conditions = await baseConditions(column, r, scope);
  const age = ageCondition(r);
  if (age) conditions.push(age);
  const search = searchCondition(q);
  if (search) conditions.push(search);
  const where = Prisma.join(conditions, " AND ");
  const joins = ageJoins(todayInArgentina(now));

  const countRows = await prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM padron_unificado p ${joins} WHERE ${where}`;
  const total = Number(countRows[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / CANDIDATES_PAGE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1)), pages);
  const rows = await prisma.$queryRaw<{ dni: string; nombre: string | null; edad: number | null; barrio: string | null; telefono: string | null; ultima_baja: Date | null }[]>`
    SELECT p.dni, p.nombre_completo AS nombre, age.edad, p.barrio, p.telefono, mb.fecha AS ultima_baja
    FROM padron_unificado p ${joins}
    LEFT JOIN LATERAL (
      SELECT fecha FROM padron_movimientos
      WHERE dni = p.dni AND programa = ${column} AND tipo = 'BAJA'
      ORDER BY fecha DESC, "createdAt" DESC LIMIT 1
    ) mb ON TRUE
    WHERE ${where}
    ORDER BY p.nombre_completo ASC NULLS LAST, p.dni ASC
    LIMIT ${CANDIDATES_PAGE} OFFSET ${(page - 1) * CANDIDATES_PAGE}`;
  return {
    total,
    page,
    pages,
    q,
    people: rows.map((row) => ({
      dni: row.dni,
      nombre: row.nombre,
      edad: row.edad === null ? null : Number(row.edad),
      barrio: row.barrio,
      telefono: row.telefono,
      ultimaBaja: row.ultima_baja ? row.ultima_baja.toISOString().slice(0, 10) : null,
    })) as ProgramCandidate[],
  };
}
