import prisma from "@/lib/prisma";
import { ContractType, HRStatus } from "@prisma/client";
import { diaAR, diaDeVencimiento } from "@/lib/fechas";

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

  const [
    total,
    active,
    newThisMonth,
    areasWithStaff,
    totalBudgetAgg,
    budgetByAreaAgg
  ] = await Promise.all([
    prisma.hRRecord.count(),
    prisma.hRRecord.count({ where: { status: 'ACTIVO' } }),
    prisma.hRRecord.count({ where: { createdAt: { gte: firstDayOfMonth } } }),
    prisma.hRRecord.groupBy({
      by: ['areaId'],
      _count: { _all: true },
      where: { NOT: { areaId: null } }
    }),
    prisma.hRRecord.aggregate({
      _sum: { salary: true }
    }),
    prisma.hRRecord.groupBy({
      by: ['areaId'],
      _sum: { salary: true },
      where: { NOT: { areaId: null } }
    })
  ]);

  const totalBudget = Number(totalBudgetAgg._sum.salary || 0);

  const budgetByArea: Record<string, number> = {};
  budgetByAreaAgg.forEach(r => {
    if (r.areaId) {
      budgetByArea[r.areaId] = Number(r._sum.salary || 0);
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

export interface StaffAway {
  id: string;
  name: string;
  status: "LICENCIA" | "VACACIONES";
  /** Último día de la licencia ("AAAA-MM-DD"), si se cargó. */
  until: string | null;
  area: string | null;
}

/**
 * Quién está de licencia o de vacaciones hoy: los que tienen ese estado y su "hasta" es hoy o más adelante
 * (o no tiene fecha). Los que figuran de licencia con la fecha ya pasada se cuentan aparte, para revisarlos.
 * Las fechas "hasta" se eligen con un calendario y quedan a la medianoche UTC de ese día.
 */
export async function getStaffAwayToday(now = new Date()): Promise<{ away: StaffAway[]; expired: number }> {
  const today = new Date(`${diaAR(now)}T00:00:00Z`);
  const status = { in: ["LICENCIA", "VACACIONES"] as HRStatus[] };
  const [rows, expired] = await Promise.all([
    prisma.hRRecord.findMany({
      where: { status, OR: [{ statusUntil: null }, { statusUntil: { gte: today } }] },
      select: { id: true, firstName: true, lastName: true, status: true, statusUntil: true, area: { select: { name: true } } },
      orderBy: [{ statusUntil: { sort: "asc", nulls: "last" } }, { lastName: "asc" }],
    }),
    prisma.hRRecord.count({ where: { status, statusUntil: { lt: today } } }),
  ]);
  return {
    away: rows.map((r) => ({
      id: r.id,
      name: `${r.lastName}, ${r.firstName}`,
      status: r.status as StaffAway["status"],
      until: r.statusUntil ? diaDeVencimiento(r.statusUntil) : null,
      area: r.area?.name ?? null,
    })),
    expired,
  };
}
