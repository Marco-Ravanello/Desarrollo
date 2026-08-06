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
  // Casos por mes
  const cases = await prisma.case.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { createdAt: true }
  });

  // Gastos combustible por mes
  const fuel = await prisma.fuelRecord.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true, amount: true }
  });

  // Dynamically calculate months between from and to dates
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

    const monthlyCases = cases.filter(c =>
      c.createdAt.getMonth() === currentMonth && c.createdAt.getFullYear() === currentYear
    ).length;

    const monthlyFuel = fuel.filter(f =>
      f.date.getMonth() === currentMonth && f.date.getFullYear() === currentYear
    ).reduce((acc, curr) => acc + Number(curr.amount), 0);

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

  // If the selection is less than 2 months (e.g., today or 7 days), just map the days instead of months to keep charts informative!
  if (result.length <= 1) {
    const dayResult = [];
    const tempDate = new Date(from);
    while (tempDate <= to) {
      const dayStr = tempDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      const dayIndex = tempDate.getDate();
      const monthIndex = tempDate.getMonth();
      const yearIndex = tempDate.getFullYear();

      const dailyCases = cases.filter(c =>
        c.createdAt.getDate() === dayIndex && c.createdAt.getMonth() === monthIndex && c.createdAt.getFullYear() === yearIndex
      ).length;

      const dailyFuel = fuel.filter(f =>
        f.date.getDate() === dayIndex && f.date.getMonth() === monthIndex && f.date.getFullYear() === yearIndex
      ).reduce((acc, curr) => acc + Number(curr.amount), 0);

      dayResult.push({
        month: dayStr,
        casos: dailyCases,
        combustible: dailyFuel
      });

      tempDate.setDate(tempDate.getDate() + 1);
    }
    return dayResult;
  }

  return result;
}
