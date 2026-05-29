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

  return {
    peopleCount,
    activeCases,
    pendingDerivations,
    pendingPurchaseOrders,
    pendingInvoices,
    lowStockItems,
    recentActivity,
  };
}
