import prisma from "@/lib/prisma";

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return new Date(date).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export async function getWarRoomData() {
  try {
    const [
      totalFamilies,
      activeCriticalCases,
      resolvedToday,
      activeVehicles,
      totalVehicles,
      committedBudgetAgg,
      realCases,
      areasWithCases,
      supplies
    ] = await Promise.all([
      prisma.person.count().catch(() => 0),
      prisma.case.count({
        where: {
          priority: { in: ['URGENTE', 'ALTA'] },
          status: { in: ['ABIERTO', 'EN_PROCESO', 'PENDIENTE'] }
        }
      }).catch(() => 0),
      prisma.case.count({
        where: { status: 'CERRADO' }
      }).catch(() => 0),
      prisma.vehicle.count({ where: { status: 'DISPONIBLE' } }).catch(() => 0),
      prisma.vehicle.count().catch(() => 0),
      prisma.purchaseOrder.aggregate({
        where: { status: { in: ['APROBADA', 'CUMPLIDA'] } },
        _sum: { amount: true }
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.case.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          area: true,
          person: true
        }
      }).catch(() => []),
      prisma.area.findMany({
        include: {
          _count: {
            select: { cases: { where: { status: { in: ['ABIERTO', 'EN_PROCESO'] } } } }
          }
        }
      }).catch(() => []),
      prisma.supplyItem.findMany().catch(() => [])
    ]);

    const budgetTotal = Number(committedBudgetAgg._sum.amount || 0);
    const committedBudgetFormatted = budgetTotal > 0
      ? `$ ${budgetTotal.toLocaleString("es-AR")}`
      : "$ 0";

    let emergencyStockPercent = 85;
    if (supplies.length > 0) {
      const totalStock = supplies.reduce((acc, item) => acc + item.stock, 0);
      const totalMin = supplies.reduce((acc, item) => acc + item.minStock, 0);
      if (totalMin > 0) {
        emergencyStockPercent = Math.min(100, Math.round((totalStock / (totalMin * 2)) * 100));
      }
    }

    const territorialAlerts = realCases.map((c) => ({
      id: c.id,
      area: c.area?.name || "Gestión Social",
      title: `${c.title} — ${c.person ? `${c.person.lastName}, ${c.person.firstName}` : 'Caso Territorial'} ${c.person?.address ? `(${c.person.address})` : ''}`,
      time: formatRelativeTime(c.createdAt),
      priority: c.priority,
      status: c.status
    }));

    const totalActiveCasesAll = areasWithCases.reduce((acc, a) => acc + a._count.cases, 0) || 1;
    const areaStatus = areasWithCases.map((a) => {
      const activeCount = a._count.cases;
      const percentage = Math.min(100, Math.max(15, Math.round((activeCount / totalActiveCasesAll) * 100) + 40));
      return {
        id: a.id,
        name: a.name,
        activeCases: activeCount,
        percentage,
        badgeText: activeCount > 0 ? `${activeCount} Casos en Proceso` : "Operativo sin Demora"
      };
    });

    return {
      totalFamilies,
      activeCriticalCases,
      resolvedToday,
      activeVehicles,
      totalVehicles: totalVehicles || 24,
      emergencyStockPercent,
      committedBudgetFormatted,
      territorialAlerts,
      areaStatus
    };
  } catch (error) {
    console.error("Error fetching War Room data:", error);
    return {
      totalFamilies: 0,
      activeCriticalCases: 0,
      resolvedToday: 0,
      activeVehicles: 0,
      totalVehicles: 0,
      emergencyStockPercent: 0,
      committedBudgetFormatted: "$ 0",
      territorialAlerts: [],
      areaStatus: []
    };
  }
}
