import prisma from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";

export const CreatePurchaseOrderItemSchema = z.object({
  quantity: z.number().or(z.string().transform(Number)),
  unitOfMeasure: z.string().optional().nullable(),
  description: z.string(),
  unitPrice: z.number().or(z.string().transform(Number)),
  totalPrice: z.number().or(z.string().transform(Number)),
});

export const CreatePurchaseOrderSchema = z.object({
  number: z.string(),
  providerId: z.string().optional().nullable(),
  providerName: z.string().optional().nullable(),
  providerCuit: z.string().optional().nullable(),
  providerNumber: z.string().optional().nullable(),
  amount: z.number().or(z.string().transform(Number)),
  description: z.string().optional().nullable(),
  expediente: z.string().optional().nullable(),
  deliveryDate: z.string().or(z.date()).optional().nullable(),
  deliveryPlace: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  items: z.array(CreatePurchaseOrderItemSchema).optional(),
});

export const CreateProviderSchema = z.object({
  name: z.string().min(1),
  cuit: z.string().min(1),
  bank: z.string().optional().nullable(),
  cbu: z.string().optional().nullable(),
});

export const CreateVehicleSchema = z.object({
  plate: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
});

export const CreateSupplySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  stock: z.number().or(z.string().transform(Number)),
  minStock: z.number().or(z.string().transform(Number)),
  areaId: z.string().optional().nullable(),
});

export const CreateAgreementSchema = z.object({
  number: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  parties: z.string().min(1),
  amount: z.number().or(z.string().transform(Number)).optional().nullable(),
  startDate: z.string().or(z.date()).optional().nullable(),
  endDate: z.string().or(z.date()).optional().nullable(),
  status: z.enum(["EN_REVISION", "VIGENTE", "VENCIDO", "RESCINDIDO", "FINALIZADO"]).optional().nullable(),
  areaId: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
});

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

export async function createPurchaseOrder(rawData: z.infer<typeof CreatePurchaseOrderSchema>) {
  const data = CreatePurchaseOrderSchema.parse(rawData);

  return await prisma.purchaseOrder.create({
    data: {
      number: data.number,
      providerId: data.providerId || null,
      providerName: data.providerName || null,
      providerCuit: data.providerCuit || null,
      providerNumber: data.providerNumber || null,
      amount: data.amount,
      description: data.description || "",
      expediente: data.expediente || null,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
      deliveryPlace: data.deliveryPlace || null,
      paymentTerms: data.paymentTerms || null,
      status: 'PENDIENTE_APROBACION',
      items: data.items ? {
        create: data.items.map((item) => ({
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

export async function createProvider(rawData: z.infer<typeof CreateProviderSchema>) {
  const data = CreateProviderSchema.parse(rawData);

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
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return await prisma.vehicle.findMany({
    include: {
      _count: { select: { reservations: true } },
      reservations: {
        where: {
          status: { in: ['APROBADA', 'EN_CURSO', 'PENDIENTE'] },
          endDate: { gte: yesterday }
        },
        include: {
          user: {
            select: { name: true }
          }
        },
        orderBy: { startDate: 'asc' }
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

export async function createVehicle(rawData: z.infer<typeof CreateVehicleSchema>) {
  const data = CreateVehicleSchema.parse(rawData);

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

export async function createSupply(rawData: z.infer<typeof CreateSupplySchema>) {
  const data = CreateSupplySchema.parse(rawData);

  return await prisma.supplyItem.create({
    data: {
      name: data.name,
      description: data.description,
      stock: typeof data.stock === "number" ? data.stock : parseInt(data.stock),
      minStock: typeof data.minStock === "number" ? data.minStock : parseInt(data.minStock),
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

export async function createAgreement(rawData: z.infer<typeof CreateAgreementSchema>) {
  const data = CreateAgreementSchema.parse(rawData);

  return await prisma.agreement.create({
    data: {
      number: data.number,
      title: data.title,
      description: data.description,
      parties: data.parties,
      amount: data.amount || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status || 'VIGENTE',
      areaId: data.areaId || null,
      fileUrl: data.fileUrl || null
    }
  });
}
