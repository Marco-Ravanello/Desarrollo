import prisma from "@/lib/prisma";

export async function getPurchaseOrders() {
  return await prisma.purchaseOrder.findMany({
    include: { provider: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getVehicles() {
  return await prisma.vehicle.findMany({
    include: {
      _count: {
        select: { reservations: true }
      }
    }
  });
}
