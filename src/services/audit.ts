import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AUDIT_GROUPS, LOGIN_ACTIONS, actionsInGroup, type AuditGroup } from "@/lib/audit-labels";

export interface AuditFilters {
  /** Quién hizo el movimiento. */
  userId?: string;
  group?: AuditGroup;
  /** Días en hora argentina, "AAAA-MM-DD". */
  from?: string;
  to?: string;
  /** DNI, carátula de un expediente o cualquier texto del detalle. */
  q?: string;
  /** Los ingresos a la app se ocultan salvo que se pidan (o se filtre ese grupo). */
  includeLogins?: boolean;
}

export const AUDIT_PAGE_SIZE = 50;
/** Tope de filas para la descarga a Excel. */
export const AUDIT_EXPORT_LIMIT = 5000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Medianoche argentina de un día "AAAA-MM-DD" (la Argentina no tiene horario de verano). */
function startOfArDay(day: string): Date {
  return new Date(`${day}T00:00:00-03:00`);
}

export function parseAuditFilters(params: Record<string, string | undefined>): AuditFilters {
  const group = AUDIT_GROUPS.some((g) => g.id === params.tipo) ? (params.tipo as AuditGroup) : undefined;
  return {
    userId: params.persona && params.persona !== "all" ? params.persona : undefined,
    group,
    from: params.desde && DAY.test(params.desde) ? params.desde : undefined,
    to: params.hasta && DAY.test(params.hasta) ? params.hasta : undefined,
    q: params.q?.trim() ? params.q.trim().slice(0, 100) : undefined,
    includeLogins: params.ingresos === "1",
  };
}

async function buildWhere(filters: AuditFilters): Promise<Prisma.AuditLogWhereInput> {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (filters.userId) and.push({ userId: filters.userId });

  if (filters.group) {
    const { actions, prefixes, entities } = actionsInGroup(filters.group);
    and.push({
      OR: [
        { action: { in: actions } },
        ...prefixes.map((p) => ({ action: { startsWith: p } })),
        ...(entities.length ? [{ action: { in: ["CREATE", "UPDATE", "DELETE"] }, entity: { in: entities } }] : []),
      ],
    });
  }
  if (filters.group !== "ingresos" && !filters.includeLogins) {
    and.push({ action: { notIn: LOGIN_ACTIONS } });
  }

  if (filters.from || filters.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from) createdAt.gte = startOfArDay(filters.from);
    if (filters.to) createdAt.lt = new Date(startOfArDay(filters.to).getTime() + 86_400_000);
    and.push({ createdAt });
  }

  if (filters.q) {
    const q = filters.q;
    const or: Prisma.AuditLogWhereInput[] = [
      { details: { contains: q, mode: "insensitive" } },
      { entityId: q },
    ];
    // Por carátula: los movimientos de los expedientes que la tienen (los detalles viejos no siempre la nombran).
    if (!/^\d+$/.test(q) && q.length >= 3) {
      const cases = await prisma.case.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        select: { id: true },
        take: 100,
      });
      if (cases.length) or.push({ entity: "Case", entityId: { in: cases.map((c) => c.id) } });
    }
    and.push({ OR: or });
  }

  return and.length ? { AND: and } : {};
}

const include = { user: { select: { id: true, name: true, username: true, email: true, area: { select: { name: true } } } } } as const;

export async function searchAuditLogs(filters: AuditFilters, page = 1) {
  const where = await buildWhere(filters);
  const skip = (Math.max(1, page) - 1) * AUDIT_PAGE_SIZE;
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include, orderBy: { createdAt: "desc" }, skip, take: AUDIT_PAGE_SIZE }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
}

export async function exportAuditLogs(filters: AuditFilters) {
  const where = await buildWhere(filters);
  return prisma.auditLog.findMany({ where, include, orderBy: { createdAt: "desc" }, take: AUDIT_EXPORT_LIMIT });
}

/** Los movimientos más recientes, sin ingresos (para el inicio de Auditoría). */
export async function getRecentAuditActivity(limit = 8) {
  return prisma.auditLog.findMany({
    where: { action: { notIn: LOGIN_ACTIONS } },
    include,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Personas para el filtro "Quién": todos los usuarios, por nombre. */
export async function getAuditPeople() {
  return prisma.user.findMany({
    select: { id: true, name: true, username: true, email: true },
    orderBy: { name: "asc" },
  });
}

export type AuditRow = Awaited<ReturnType<typeof searchAuditLogs>>["rows"][number];
