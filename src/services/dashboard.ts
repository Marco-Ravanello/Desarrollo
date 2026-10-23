import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getPeopleStats, getPeopleForMap } from "@/services/people";
import { staleCutoff, summarizeCase } from "@/lib/case-summary";
import { diaAR, diaDeVencimiento, diasEntre, formatFecha, formatFechaCorta } from "@/lib/fechas";

/**
 * Qué parte de la gestión ve quien abre el dashboard.
 * - areaId: si viene, casos y presupuesto se limitan a esa área.
 * - canViewSensitive: si es false, los casos de Violencia de Género no se cuentan ni se listan
 *   (mismo criterio que el listado de Casos).
 */
export interface DashboardScope {
  areaId?: string | null;
  canViewSensitive: boolean;
}

export const ACTIVE_CASE_STATUSES = ["ABIERTO", "EN_PROCESO"] as const;

export function dashboardCaseWhere(scope: DashboardScope): Prisma.CaseWhereInput {
  const where: Prisma.CaseWhereInput = {};
  if (scope.areaId) where.areaId = scope.areaId;
  if (!scope.canViewSensitive) {
    where.NOT = { area: { name: { contains: "violencia", mode: "insensitive" } } };
  }
  return where;
}

const cache = new Map<string, { data: DashboardStats; timestamp: number }>();
const DASHBOARD_CACHE_TTL = 45 * 1000; // 45 segundos

export type DashboardStats = Awaited<ReturnType<typeof loadDashboardStats>>;

export async function getDashboardStats(scope: DashboardScope): Promise<DashboardStats> {
  const key = `${scope.areaId || "all"}_${scope.canViewSensitive ? "s" : "ns"}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL) {
    return cached.data;
  }

  const data = await loadDashboardStats(scope);
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

async function loadDashboardStats(scope: DashboardScope) {
  const caseWhere = dashboardCaseWhere(scope);
  const activeWhere: Prisma.CaseWhereInput = { ...caseWhere, status: { in: [...ACTIVE_CASE_STATUSES] } };
  const urgentWhere: Prisma.CaseWhereInput = { ...activeWhere, priority: "URGENTE" };
  const orderWhere: Prisma.PurchaseOrderWhereInput = scope.areaId ? { areaId: scope.areaId } : {};

  const [
    peopleStats,
    peopleLocations,
    legacyPeopleCount,
    activeCases,
    criticalCases,
    closedCases,
    pendingPurchaseOrders,
    lowStockItems,
    executedOrders,
    budgetAreas,
    recentCasesDb,
    urgentCasesDb,
    pendingOrdersDb,
    vehiclesDb,
  ] = await Promise.all([
    getPeopleStats().catch(() => ({ total: 0, avgAge: 0, topArea: "Sin datos", localityTotals: {} })),
    getPeopleForMap(200).catch(() => []),
    prisma.person.count().catch(() => 0),
    prisma.case.count({ where: activeWhere }).catch(() => 0),
    prisma.case.count({ where: urgentWhere }).catch(() => 0),
    prisma.case.count({ where: { ...caseWhere, status: "CERRADO" } }).catch(() => 0),
    prisma.purchaseOrder.count({ where: { ...orderWhere, status: "PENDIENTE_APROBACION" } }).catch(() => 0),
    prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int as total FROM "SupplyItem" WHERE stock <= "minStock" OR stock <= 0;`
    ).then((res) => res[0]?.total || 0).catch(() => 0),
    prisma.purchaseOrder.aggregate({
      where: { ...orderWhere, status: { in: ["APROBADA", "CUMPLIDA"] } },
      _sum: { amount: true },
    }).then((r) => Number(r._sum.amount || 0)).catch(() => 0),
    prisma.area.findMany({
      where: scope.areaId ? { id: scope.areaId } : undefined,
      orderBy: { name: "asc" },
    }).catch(() => []),
    prisma.case.findMany({
      where: caseWhere,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { person: true, area: true },
    }).catch(() => []),
    prisma.case.findMany({
      where: urgentWhere,
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { area: true },
    }).catch(() => []),
    prisma.purchaseOrder.findMany({
      where: { ...orderWhere, status: "PENDIENTE_APROBACION" },
      orderBy: { createdAt: "desc" },
      take: 2,
    }).catch(() => []),
    prisma.vehicle.findMany({ take: 5, orderBy: { plate: "asc" } }).catch(() => []),
  ]);

  const peopleCount = peopleStats?.total && peopleStats.total > 0 ? peopleStats.total : legacyPeopleCount;

  const topArea =
    peopleStats?.topArea && peopleStats.topArea !== "Sin datos" && !peopleStats.topArea.toLowerCase().includes("partido")
      ? peopleStats.topArea
      : null;

  // Presupuesto: total de las áreas visibles y lo ejecutado por cada una.
  const totalBudget = budgetAreas.reduce((sum, a) => sum + Number(a.annualBudget || 0), 0);
  const executedByArea = new Map<string, number>();
  if (budgetAreas.length > 0) {
    const perArea = await prisma.purchaseOrder.groupBy({
      by: ["areaId"],
      where: { ...orderWhere, status: { in: ["APROBADA", "CUMPLIDA"] } },
      _sum: { amount: true },
    }).catch(() => []);
    perArea.forEach((o) => {
      if (o.areaId) executedByArea.set(o.areaId, Number(o._sum.amount || 0));
    });
  }

  const areaColors = ["bg-blue-600", "bg-amber-500", "bg-emerald-500", "bg-purple-600", "bg-rose-500"];
  const areaBudgetProgress = budgetAreas
    .filter((a) => Number(a.annualBudget || 0) > 0)
    .slice(0, 4)
    .map((a, idx) => {
      const annual = Number(a.annualBudget || 0);
      const executed = executedByArea.get(a.id) || 0;
      return {
        name: a.name.replace("Dirección de ", "").replace("Coordinación de ", "").trim(),
        percentage: annual > 0 ? Math.round((executed / annual) * 100) : 0,
        color: areaColors[idx % areaColors.length],
      };
    });

  const recentCases = recentCasesDb.map((c) => ({
    id: c.id,
    openedOn: formatFechaCorta(c.createdAt),
    citizenName: c.person ? `${c.person.lastName}, ${c.person.firstName}` : c.title,
    type: c.area?.name || "General",
    status: c.status === "CERRADO" ? "Resuelto" : c.status === "EN_PROCESO" ? "En proceso" : "Abierto",
    statusVariant: c.status === "CERRADO" ? "resolved" : c.status === "EN_PROCESO" ? "in_progress" : "pending",
  }));

  const attentionItems = [
    ...urgentCasesDb.map((c) => ({
      id: c.id,
      type: "case" as const,
      title: c.title,
      subtitle: `Urgente · ${c.area?.name || "General"}`,
      href: `/cases/${c.id}`,
    })),
    ...pendingOrdersDb.map((po) => ({
      id: po.id,
      type: "po" as const,
      title: `Orden de compra #${po.number}`,
      subtitle: `$ ${Number(po.amount).toLocaleString("es-AR")} · Pendiente de firma`,
      href: `/admin/purchase-orders/${po.id}`,
    })),
  ];

  const vehiclesList = vehiclesDb.map((v) => ({
    id: v.id,
    name: `${v.brand} ${v.model} (${v.plate})`,
    status: v.status === "DISPONIBLE" ? "Disponible" : v.status === "EN_TALLER" ? "En taller" : "Fuera de servicio",
    statusVariant: v.status === "DISPONIBLE" ? "active" : v.status === "EN_TALLER" ? "maintenance" : "inactive",
    nextExpiry: v.vtvExpiry
      ? `VTV: ${new Date(v.vtvExpiry).toLocaleDateString("es-AR", { month: "2-digit", year: "2-digit", timeZone: "UTC" })}`
      : "Al día",
  }));

  return {
    peopleCount,
    peopleLocations,
    topArea,
    activeCases,
    criticalCases,
    closedCases,
    pendingPurchaseOrders,
    lowStockItems,
    totalBudget,
    executedAmount: executedOrders,
    areaBudgetProgress,
    recentCases,
    attentionItems,
    vehiclesList,
  };
}

// ---------------------------------------------------------------------------
// Inicio según el rol: resumen por área (Dirección General), equipo del área
// (Dirección de Área) y seguimientos del día (Operativo).
// ---------------------------------------------------------------------------

/** Expedientes sin cerrar y sin intervenciones hace STALE_DAYS días o más (mismo criterio que la lista). */
export function staleCaseWhere(scope: DashboardScope, now = new Date()): Prisma.CaseWhereInput {
  const cutoff = staleCutoff(now);
  return {
    ...dashboardCaseWhere(scope),
    status: { not: "CERRADO" },
    createdAt: { lt: cutoff },
    interventions: { none: { date: { gte: cutoff } } },
  };
}

export async function countStaleCases(scope: DashboardScope): Promise<number> {
  return prisma.case.count({ where: staleCaseWhere(scope) }).catch(() => 0);
}

/** Derivaciones que esperan respuesta del área (o de todas). */
export async function countPendingDerivations(scope: DashboardScope): Promise<number> {
  return prisma.derivation
    .count({
      where: {
        status: "PENDIENTE",
        ...(scope.areaId ? { toAreaId: scope.areaId } : {}),
        ...(scope.canViewSensitive ? {} : { NOT: { toArea: { name: { contains: "violencia", mode: "insensitive" } } } }),
      },
    })
    .catch(() => 0);
}

export interface AreaOverviewRow {
  id: string;
  name: string;
  open: number;
  urgent: number;
  stale: number;
  derivations: number;
}

/** Una fila por área con sus expedientes abiertos, urgentes, quietos y derivaciones sin responder. */
export async function getAreaOverview(scope: DashboardScope): Promise<AreaOverviewRow[]> {
  const base = dashboardCaseWhere(scope);
  const active: Prisma.CaseWhereInput = { ...base, status: { in: [...ACTIVE_CASE_STATUSES] } };
  const [areas, open, urgent, stale, derivations] = await Promise.all([
    prisma.area.findMany({
      where: scope.canViewSensitive ? {} : { NOT: { name: { contains: "violencia", mode: "insensitive" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.case.groupBy({ by: ["areaId"], where: active, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["areaId"], where: { ...active, priority: "URGENTE" }, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["areaId"], where: staleCaseWhere(scope), _count: { _all: true } }),
    prisma.derivation.groupBy({ by: ["toAreaId"], where: { status: "PENDIENTE" }, _count: { _all: true } }),
  ]);
  const count = (rows: { _count: { _all: number } }[], key: (r: any) => string, id: string) =>
    rows.find((r) => key(r) === id)?._count._all ?? 0;
  return areas.map((a) => ({
    id: a.id,
    name: a.name,
    open: count(open, (r) => r.areaId, a.id),
    urgent: count(urgent, (r) => r.areaId, a.id),
    stale: count(stale, (r) => r.areaId, a.id),
    derivations: count(derivations, (r) => r.toAreaId, a.id),
  }));
}

export interface TeamMemberRow {
  /** null = expedientes sin profesional a cargo. */
  userId: string | null;
  name: string;
  open: number;
  stale: number;
}

/** Cuántos expedientes sin cerrar tiene a cargo cada profesional del área, y cuántos están quietos. */
export async function getAreaTeam(scope: DashboardScope & { areaId: string }): Promise<TeamMemberRow[]> {
  const notClosed: Prisma.CaseWhereInput = { ...dashboardCaseWhere(scope), status: { not: "CERRADO" } };
  const [members, open, stale] = await Promise.all([
    prisma.user.findMany({
      where: { areaId: scope.areaId, isActive: true, role: { in: ["DIRECTOR_AREA", "OPERATIVO", "VIOLENCIA_GENERO"] } },
      select: { id: true, name: true, username: true },
    }),
    prisma.case.groupBy({ by: ["assignedToId"], where: notClosed, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["assignedToId"], where: staleCaseWhere(scope), _count: { _all: true } }),
  ]);
  const openOf = (id: string | null) => open.find((r) => r.assignedToId === id)?._count._all ?? 0;
  const staleOf = (id: string | null) => stale.find((r) => r.assignedToId === id)?._count._all ?? 0;

  // Quien tiene expedientes del área a cargo aunque sea de otra área (por ejemplo, después de una derivación).
  const extraIds = open.map((r) => r.assignedToId).filter((id): id is string => Boolean(id) && !members.some((m) => m.id === id));
  const extra = extraIds.length
    ? await prisma.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true, username: true } })
    : [];

  const rows: TeamMemberRow[] = [...members, ...extra].map((m) => ({
    userId: m.id,
    name: m.name || m.username || "Sin nombre",
    open: openOf(m.id),
    stale: staleOf(m.id),
  }));
  rows.sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "es"));
  const unassigned = openOf(null);
  if (unassigned > 0) rows.push({ userId: null, name: "Sin profesional a cargo", open: unassigned, stale: staleOf(null) });
  return rows;
}

export interface QuietCase {
  id: string;
  title: string;
  titular: string | null;
  assignee: string | null;
  quietDays: number;
}

/** Los expedientes sin cerrar que llevan más tiempo sin movimiento (primero los más quietos). */
export async function getQuietCases(scope: DashboardScope, limit = 5): Promise<QuietCase[]> {
  const rows = await prisma.case.findMany({
    where: staleCaseWhere(scope),
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      person: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { name: true, username: true } },
      interventions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
    // Los quietos son pocos comparados con el total; se ordenan acá por la última intervención.
    take: 500,
    orderBy: { updatedAt: "asc" },
  });
  const now = new Date();
  return rows
    .map((c) => ({
      id: c.id,
      title: c.title,
      titular: c.person ? `${c.person.lastName}, ${c.person.firstName}` : null,
      assignee: c.assignedTo ? c.assignedTo.name || c.assignedTo.username : null,
      quietDays: summarizeCase({ status: c.status, createdAt: c.createdAt, lastInterventionAt: c.interventions[0]?.date ?? null, now }).quietDays,
    }))
    .sort((a, b) => b.quietDays - a.quietDays)
    .slice(0, limit);
}

export interface DueFollowUp {
  id: string;
  title: string;
  caseId: string;
  caseTitle: string;
  /** Días de atraso (0 = vence hoy). */
  overdueDays: number;
}

/** Seguimientos agendados por la persona que vencen hoy o ya vencieron (sin marcar como hechos). */
export async function getFollowUpsDue(userId: string, now = new Date()): Promise<DueFollowUp[]> {
  const today = diaAR(now);
  const rows = await prisma.task.findMany({
    where: {
      userId,
      caseId: { not: null },
      status: { not: "COMPLETADA" },
      // Margen de un día: el día exacto se compara abajo en hora argentina.
      dueDate: { lte: new Date(now.getTime() + 86_400_000) },
    },
    select: { id: true, title: true, dueDate: true, caseId: true, case: { select: { title: true } } },
    orderBy: { dueDate: "asc" },
    take: 50,
  });
  return rows
    .filter((t) => t.dueDate && t.caseId && diaDeVencimiento(t.dueDate) <= today)
    .map((t) => ({
      id: t.id,
      title: t.title,
      caseId: t.caseId!,
      caseTitle: t.case?.title ?? "Expediente",
      overdueDays: diasEntre(diaDeVencimiento(t.dueDate!), today),
    }));
}
