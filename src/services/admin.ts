import prisma from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

export async function getPurchaseOrders(status?: string) {
  return await prisma.purchaseOrder.findMany({
    where: status ? { status: status as OrderStatus } : {},
    include: { provider: true, area: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAgreementById(id: string) {
  return await prisma.agreement.findUnique({
    where: { id },
    include: { area: true }
  });
}

export async function getPurchaseOrderById(id: string) {
  return await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      provider: {
        include: {
          orders: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, number: true, amount: true, createdAt: true, status: true }
          },
          _count: { select: { orders: true } }
        }
      },
      area: true,
      items: true
    }
  });
}

export async function getOrderAuditLogs(id: string) {
  return await prisma.auditLog.findMany({
    where: { entityId: id, entity: 'PurchaseOrder' },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createPurchaseOrder(data: any) {
  return await prisma.purchaseOrder.create({
    data: {
      number: data.number,
      providerId: data.providerId || null,
      providerName: data.providerName || null,
      providerCuit: data.providerCuit || null,
      amount: data.amount,
      description: data.description,
      expediente: data.expediente || null,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
      deliveryPlace: data.deliveryPlace || null,
      paymentTerms: data.paymentTerms || null,
      status: 'PENDIENTE_APROBACION',
      items: data.items ? {
        create: data.items.map((item: any) => ({
          quantity: item.quantity,
          unitOfMeasure: item.unitOfMeasure,
          description: item.description,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      } : undefined
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
      _count: { select: { reservations: true } },
      reservations: {
        where: {
          status: { in: ['APROBADA', 'EN_CURSO'] },
          startDate: { lte: now },
          endDate: { gte: now }
        },
        take: 1
      },
      fuelRecords: { orderBy: { date: 'desc' } }
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
          user: {
            select: {
              name: true,
              area: { select: { name: true } }
            }
          }
        }
      },
      fuelRecords: { orderBy: { date: 'desc' } }
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

export async function getAllReservations() {
  return await prisma.vehicleReservation.findMany({
    include: {
      vehicle: { select: { plate: true, brand: true, model: true } },
      user: {
        select: {
          name: true,
          area: { select: { name: true } }
        }
      }
    },
    orderBy: { startDate: 'asc' }
  });
}

export async function getSupplies() {
  return await prisma.supplyItem.findMany({
    include: { area: true },
    orderBy: { name: 'asc' }
  });
}

export async function createSupply(data: any) {
  return await prisma.supplyItem.create({
    data: {
      name: data.name,
      description: data.description,
      stock: parseInt(data.stock),
      minStock: parseInt(data.minStock),
      areaId: data.areaId || null
    }
  });
}

export async function updateSupplyStock(id: string, newStock: number) {
  return await prisma.supplyItem.update({
    where: { id },
    data: { stock: newStock }
  });
}

export async function getAgreements() {
  return await prisma.agreement.findMany({
    include: { area: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createAgreement(data: any) {
  return await prisma.agreement.create({
    data: {
      number: data.number,
      title: data.title,
      description: data.description,
      parties: data.parties,
      amount: data.amount,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status || 'VIGENTE',
      areaId: data.areaId || null,
      fileUrl: data.fileUrl || null
    }
  });
}
