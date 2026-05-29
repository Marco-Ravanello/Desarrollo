import prisma from "@/lib/prisma";

export async function getDashboardStats() {
  const [
    peopleCount,
    activeCases,
    pendingDerivations,
    pendingPurchaseOrders,
    pendingInvoices,
    lowStockItems,
  ] = await Promise.all([
    prisma.person.count(),
    prisma.case.count({ where: { status: { in: ['ABIERTO', 'EN_PROCESO'] } } }),
    prisma.derivation.count({ where: { status: 'PENDIENTE' } }),
    prisma.purchaseOrder.count({ where: { status: 'PENDIENTE_APROBACION' } }),
    prisma.invoice.count({ where: { status: 'PENDIENTE' } }),
    prisma.supplyItem.count({ where: { stock: { lte: 0 } } }),
  ]);

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
  };
}
