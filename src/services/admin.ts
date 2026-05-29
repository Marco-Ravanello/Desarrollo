import prisma from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

export async function getPurchaseOrders(status?: string) {
  return await prisma.purchaseOrder.findMany({
    where: status ? { status: status as OrderStatus } : {},
    include: { provider: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createPurchaseOrder(data: any) {
  return await prisma.purchaseOrder.create({
    data: {
      number: data.number,
      providerId: data.providerId,
      amount: data.amount,
      description: data.description,
      status: 'PENDIENTE_APROBACION'
    }
  });
}

export async function getProviders() {
  return await prisma.provider.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function createProvider(data: any) {
  return await prisma.provider.create({
    data: {
      name: data.name,
      cuit: data.cuit,
      bank: data.bank,
      cbu: data.cbu
    }
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

export async function createVehicle(data: any) {
  return await prisma.vehicle.create({
    data: {
      plate: data.plate,
      brand: data.brand,
      model: data.model
    }
  });
}
