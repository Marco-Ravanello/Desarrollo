import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getPeopleStats, getPeopleForMap } from "@/services/people";

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
    shortId: `#${c.id.substring(0, 6)}`,
    citizenName: c.person ? `${c.person.lastName}, ${c.person.firstName}` : "S/D",
    type: c.area?.name || "General",
    status: c.status === "CERRADO" ? "Resuelto" : c.status === "EN_PROCESO" ? "En Proceso" : "Abierto",
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
    status: v.status === "DISPONIBLE" ? "Disponible" : v.status === "EN_TALLER" ? "En Taller" : "Fuera de Servicio",
    statusVariant: v.status === "DISPONIBLE" ? "active" : v.status === "EN_TALLER" ? "maintenance" : "inactive",
    nextExpiry: v.vtvExpiry
      ? `VTV: ${new Date(v.vtvExpiry).toLocaleDateString("es-AR", { month: "2-digit", year: "2-digit" })}`
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
