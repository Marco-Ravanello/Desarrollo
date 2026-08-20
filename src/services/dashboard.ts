import prisma from "@/lib/prisma";

export function parseDateRange(range?: string, fromStr?: string, toStr?: string) {
  const now = new Date();

  // Default to last 30 days
  let from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  let to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (range === "today") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (range === "7days") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
  } else if (range === "30days") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
  } else if (range === "thismonth") {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (range === "year") {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  } else if (range === "custom" && fromStr && toStr) {
    from = new Date(fromStr);
    from.setHours(0, 0, 0, 0);
    to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
  }

  return { from, to };
}

export async function getDashboardStats(filters?: { from: Date; to: Date }) {
  const { from, to } = filters || parseDateRange("30days");

  const dateFilter = { gte: from, lte: to };

  const [
    peopleCount,
    activeCases,
    pendingDerivations,
    pendingPurchaseOrders,
    pendingInvoices,
    lowStockItems,
    vehicleCount,
    todayTasks,
    criticalCases,
  ] = await Promise.all([
    prisma.person.count({ where: { createdAt: dateFilter } }),
    prisma.case.count({ where: { status: { in: ['ABIERTO', 'EN_PROCESO'] }, createdAt: dateFilter } }),
    prisma.derivation.count({ where: { status: 'PENDIENTE', createdAt: dateFilter } }),
    prisma.purchaseOrder.count({ where: { status: 'PENDIENTE_APROBACION', createdAt: dateFilter } }),
    prisma.invoice.count({ where: { status: 'PENDIENTE', createdAt: dateFilter } }),
    prisma.supplyItem.count({ where: { stock: { lte: 0 } } }), // Stock doesn't have temporal filter naturally
    prisma.vehicle.count(), // Vehicle count is flat
    prisma.task.count({ where: { status: 'PENDIENTE', dueDate: { gte: from, lte: to } } }),
    prisma.case.count({ where: { priority: 'URGENTE', status: { in: ['ABIERTO', 'EN_PROCESO'] }, createdAt: dateFilter } }),
  ]);

  // Contar vehículos ocupados (reservas activas durante el período seleccionado)
  const occupiedVehicles = await prisma.vehicleReservation.count({
    where: {
      status: { in: ['APROBADA', 'EN_CURSO'] },
      startDate: { lte: to },
      endDate: { gte: from }
    }
  });

  const recentActivity = await prisma.auditLog.findMany({
    where: { createdAt: dateFilter },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });

  // Aggregated data for charts, scoped by date filter
  const casesByArea = await prisma.case.groupBy({
    by: ['areaId'],
    where: { createdAt: dateFilter },
    _count: { _all: true },
  });

  const areas = await prisma.area.findMany();
  const casesByAreaData = areas.map(area => {
    const caseCount = casesByArea.find(c => c.areaId === area.id)?._count._all || 0;
    return { name: area.name, value: caseCount };
  });

  const poByStatus = await prisma.purchaseOrder.groupBy({
    by: ['status'],
    where: { createdAt: dateFilter },
    _count: { _all: true },
  });

  const poStatusData = poByStatus.map(s => ({
    name: s.status.replace('_', ' '),
    value: s._count._all
  }));

  const executedOrders = await prisma.purchaseOrder.aggregate({
    where: {
      status: { in: ['APROBADA', 'CUMPLIDA'] },
      createdAt: dateFilter
    },
    _sum: { amount: true }
  });
  const executedAmount = Number(executedOrders._sum.amount || 0);

  return {
    peopleCount,
    activeCases,
    pendingDerivations,
    pendingPurchaseOrders,
    pendingInvoices,
    lowStockItems,
    recentActivity,
    casesByAreaData,
    poStatusData,
    todayTasks,
    criticalCases,
    vehicleStats: {
      total: vehicleCount,
      occupied: occupiedVehicles,
      available: Math.max(0, vehicleCount - occupiedVehicles)
    },
    trends: await getTrendData(from, to)
  };
}

async function getTrendData(from: Date, to: Date) {
  // We can dynamically choose whether we aggregate monthly or daily first to optimize db calls
  const isDaily = (to.getTime() - from.getTime()) <= (60 * 24 * 3600 * 1000); // Selection <= 60 days (or ~2 months)

  if (isDaily) {
    // Pre-aggregate cases by day in SQL (optimized database grouping)
    const caseDailyCounts = await prisma.$queryRaw<{ year: number; month: number; day: number; count: number }[]>`
      SELECT
        EXTRACT(YEAR FROM "createdAt")::integer as year,
        EXTRACT(MONTH FROM "createdAt")::integer as month,
        EXTRACT(DAY FROM "createdAt")::integer as day,
        COUNT(*)::integer as count
      FROM "Case"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1, 2, 3
    `;

    // Pre-aggregate fuel sums by day in SQL
    const fuelDailySums = await prisma.$queryRaw<{ year: number; month: number; day: number; sum: number }[]>`
      SELECT
        EXTRACT(YEAR FROM "date")::integer as year,
        EXTRACT(MONTH FROM "date")::integer as month,
        EXTRACT(DAY FROM "date")::integer as day,
        COALESCE(SUM("amount"), 0)::double precision as sum
      FROM "FuelRecord"
      WHERE "date" >= ${from} AND "date" <= ${to}
      GROUP BY 1, 2, 3
    `;

    const caseDailyMap = new Map<string, number>();
    caseDailyCounts.forEach(c => caseDailyMap.set(`${c.year}-${c.month}-${c.day}`, c.count));

    const fuelDailyMap = new Map<string, number>();
    fuelDailySums.forEach(f => fuelDailyMap.set(`${f.year}-${f.month}-${f.day}`, f.sum));

    const dayResult = [];
    const tempDate = new Date(from);
    while (tempDate <= to) {
      const dayStr = tempDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      const dayIndex = tempDate.getDate();
      const monthIndex = tempDate.getMonth();
      const yearIndex = tempDate.getFullYear();

      const key = `${yearIndex}-${monthIndex + 1}-${dayIndex}`;
      const dailyCases = caseDailyMap.get(key) || 0;
      const dailyFuel = fuelDailyMap.get(key) || 0;

      dayResult.push({
        month: dayStr,
        casos: dailyCases,
        combustible: dailyFuel
      });

      tempDate.setDate(tempDate.getDate() + 1);
    }
    return dayResult;
  }

  // Pre-aggregate cases by year & month in SQL (highly efficient database grouping)
  const caseCounts = await prisma.$queryRaw<{ year: number; month: number; count: number }[]>`
    SELECT
      EXTRACT(YEAR FROM "createdAt")::integer as year,
      EXTRACT(MONTH FROM "createdAt")::integer as month,
      COUNT(*)::integer as count
    FROM "Case"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1, 2
  `;

  // Pre-aggregate fuel records by year & month in SQL
  const fuelSums = await prisma.$queryRaw<{ year: number; month: number; sum: number }[]>`
    SELECT
      EXTRACT(YEAR FROM "date")::integer as year,
      EXTRACT(MONTH FROM "date")::integer as month,
      COALESCE(SUM("amount"), 0)::double precision as sum
    FROM "FuelRecord"
    WHERE "date" >= ${from} AND "date" <= ${to}
    GROUP BY 1, 2
  `;

  const caseMap = new Map<string, number>();
  caseCounts.forEach(c => caseMap.set(`${c.year}-${c.month}`, c.count));

  const fuelMap = new Map<string, number>();
  fuelSums.forEach(f => fuelMap.set(`${f.year}-${f.month}`, f.sum));

  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const result = [];

  const startMonth = from.getMonth();
  const startYear = from.getFullYear();
  const endMonth = to.getMonth();
  const endYear = to.getFullYear();

  let currentMonth = startMonth;
  let currentYear = startYear;

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    const monthName = months[currentMonth];
    const key = `${currentYear}-${currentMonth + 1}`;

    const monthlyCases = caseMap.get(key) || 0;
    const monthlyFuel = fuelMap.get(key) || 0;

    result.push({
      month: `${monthName} ${currentYear.toString().substring(2)}`,
      casos: monthlyCases,
      combustible: monthlyFuel
    });

    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  return result;
}
