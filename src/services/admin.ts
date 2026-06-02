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
  const now = new Date();
  return await prisma.vehicle.findMany({
    include: {
      _count: {
        select: { reservations: true }
      },
      reservations: {
        where: {
          status: { in: ['RESERVADO', 'EN_CURSO'] },
          startDate: { lte: now },
          endDate: { gte: now }
        },
        take: 1
      },
      fuelRecords: {
        orderBy: { date: 'desc' }
      }
    },
    orderBy: { plate: 'asc' }
  });
}

export async function getVehicleWithHistory(id: string) {
  return await prisma.vehicle.findUnique({
    where: { id },
    include: {
      reservations: {
        orderBy: { startDate: 'desc' },
        include: {
          // Si tuviéramos relación con User la incluiríamos aquí
        }
      },
      fuelRecords: {
        orderBy: { date: 'desc' }
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
