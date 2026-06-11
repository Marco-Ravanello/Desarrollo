import prisma from "@/lib/prisma";

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
    prisma.person.count(),
    prisma.case.count({ where: { status: { in: ['ABIERTO', 'EN_PROCESO'] } } }),
    prisma.derivation.count({ where: { status: 'PENDIENTE' } }),
    prisma.purchaseOrder.count({ where: { status: 'PENDIENTE_APROBACION' } }),
    prisma.invoice.count({ where: { status: 'PENDIENTE' } }),
    prisma.supplyItem.count({ where: { stock: { lte: 0 } } }),
    prisma.vehicle.count(),
    prisma.task.count({ where: { status: 'PENDIENTE', dueDate: { lte: now } } }),
    prisma.case.count({ where: { priority: 'URGENTE', status: { in: ['ABIERTO', 'EN_PROCESO'] } } }),
  ]);

  // Contar vehículos ocupados (solo los que tienen reserva APROBADA o EN_CURSO)
  const occupiedVehicles = await prisma.vehicleReservation.count({
    where: {
      status: { in: ['APROBADA', 'EN_CURSO'] },
      startDate: { lte: now },
      endDate: { gte: now }
    }
  });

  const recentActivity = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });

  // Aggregated data for charts
  const casesByArea = await prisma.case.groupBy({
    by: ['areaId'],
    _count: { _all: true },
  });

  const areas = await prisma.area.findMany();
  const casesByAreaData = areas.map(area => {
    const caseCount = casesByArea.find(c => c.areaId === area.id)?._count._all || 0;
    return { name: area.name, value: caseCount };
  });

  const poByStatus = await prisma.purchaseOrder.groupBy({
    by: ['status'],
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
      available: vehicleCount - occupiedVehicles
    },
    trends: await getTrendData()
  };
}

async function getTrendData() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  // Casos por mes
  const cases = await prisma.case.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true }
  });

  // Gastos combustible por mes
  const fuel = await prisma.fuelRecord.findMany({
    where: { date: { gte: sixMonthsAgo } },
    select: { date: true, amount: true }
  });

  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const result = [];

  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthIndex = d.getMonth();
    const monthYear = `${months[monthIndex]}`;

    const monthlyCases = cases.filter(c =>
      c.createdAt.getMonth() === monthIndex && c.createdAt.getFullYear() === d.getFullYear()
    ).length;

    const monthlyFuel = fuel.filter(f =>
      f.date.getMonth() === monthIndex && f.date.getFullYear() === d.getFullYear()
    ).reduce((acc, curr) => acc + Number(curr.amount), 0);

    result.push({
      month: monthYear,
      casos: monthlyCases,
      combustible: monthlyFuel
    });
  }

  return result;
}
