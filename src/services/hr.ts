import prisma from "@/lib/prisma";
import { ContractType, HRStatus } from "@prisma/client";

export async function getHRRecords(filters?: { query?: string, areaId?: string, status?: string }) {
  const where: any = {};

  if (filters?.query) {
    where.OR = [
      { firstName: { contains: filters.query, mode: 'insensitive' } },
      { lastName: { contains: filters.query, mode: 'insensitive' } },
      { dni: { contains: filters.query } },
      { fileNumber: { contains: filters.query } },
    ];
  }

  if (filters?.areaId && filters.areaId !== 'all') {
    where.areaId = filters.areaId;
  }

  if (filters?.status && filters.status !== 'all') {
    where.status = filters.status as HRStatus;
  }

  return await prisma.hRRecord.findMany({
    where,
    include: { area: true },
    orderBy: { lastName: 'asc' }
  });
}

export async function getHRRecordById(id: string) {
  return await prisma.hRRecord.findUnique({
    where: { id },
    include: { area: true }
  });
}

export async function getHRStats() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, active, newThisMonth, areasWithStaff] = await Promise.all([
    prisma.hRRecord.count(),
    prisma.hRRecord.count({ where: { status: 'ACTIVO' } }),
    prisma.hRRecord.count({ where: { createdAt: { gte: firstDayOfMonth } } }),
    prisma.hRRecord.groupBy({
      by: ['areaId'],
      _count: { _all: true },
      where: { NOT: { areaId: null } }
    })
  ]);

  const rawRecords = await prisma.hRRecord.findMany({
    select: {
      salary: true,
      areaId: true
    }
  });

  const totalBudget = rawRecords.reduce((acc, curr) => acc + Number(curr.salary || 0), 0);

  const budgetByArea: Record<string, number> = {};
  rawRecords.forEach(r => {
    if (r.areaId) {
        budgetByArea[r.areaId] = (budgetByArea[r.areaId] || 0) + Number(r.salary || 0);
    }
  });

  return {
    total,
    active,
    newThisMonth,
    areaCount: areasWithStaff.length,
    totalBudget,
    budgetByArea
  };
}

export async function createHRRecord(data: any) {
  return await prisma.hRRecord.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      dni: data.dni,
      fileNumber: data.fileNumber,
      startDate: data.startDate ? new Date(data.startDate) : null,
      position: data.position,
      areaId: data.areaId || null,
      status: (data.status as HRStatus) || 'ACTIVO',
      statusUntil: data.statusUntil ? new Date(data.statusUntil) : null,
      contractType: (data.contractType as ContractType) || 'MENSUALIZADO',
      category: data.category || null,
      salary: data.salary || 0,
      schedule: data.schedule,
      imageUrl: data.imageUrl,
      tasks: data.tasks
    }
  });
}
