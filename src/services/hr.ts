import prisma from "@/lib/prisma";
import { ContractType, HRStatus } from "@prisma/client";

export async function getHRRecords() {
  return await prisma.hRRecord.findMany({
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

  return {
    total,
    active,
    newThisMonth,
    areaCount: areasWithStaff.length
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
      contractType: (data.contractType as ContractType) || 'MENSUALIZADO',
      salary: data.salary || 0,
      tasks: data.tasks
    }
  });
}
