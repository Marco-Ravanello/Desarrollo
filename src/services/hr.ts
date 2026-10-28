import prisma from "@/lib/prisma";
import { canEditHR, currentMonthRange } from "@/lib/hr-labels";
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
  // "Ingresaron este mes" se cuenta por la fecha de ingreso, no por cuándo se cargó en la app.
  const month = currentMonthRange();

  const [
    total,
    active,
    newThisMonth,
    areasWithStaff,
    totalBudgetAgg,
    budgetByAreaAgg,
    withSalary,
    areasTotal,
    inPayroll
  ] = await Promise.all([
    prisma.hRRecord.count(),
    prisma.hRRecord.count({ where: { status: 'ACTIVO' } }),
    prisma.hRRecord.count({ where: { startDate: { gte: month.from, lt: month.to } } }),
    prisma.hRRecord.groupBy({
      by: ['areaId'],
      _count: { _all: true },
      where: { NOT: { areaId: null } }
    }),
    // Los sueldos son de quienes siguen en la planta: los dados de baja no cuentan.
    prisma.hRRecord.aggregate({
      _sum: { salary: true },
      where: { NOT: { status: 'BAJA' } }
    }),
    prisma.hRRecord.groupBy({
      by: ['areaId'],
      _sum: { salary: true },
      where: { NOT: [{ areaId: null }, { status: 'BAJA' }] }
    }),
    prisma.hRRecord.count({ where: { salary: { gt: 0 }, NOT: { status: 'BAJA' } } }),
    prisma.area.count(),
    prisma.hRRecord.count({ where: { NOT: { status: 'BAJA' } } })
  ]);

  const totalBudget = Number(totalBudgetAgg._sum.salary || 0);

  const budgetByArea: Record<string, number> = {};
  budgetByAreaAgg.forEach(r => {
    if (r.areaId) {
      budgetByArea[r.areaId] = Number(r._sum.salary || 0);
    }
  });

  const staffByArea: Record<string, number> = {};
  areasWithStaff.forEach(r => {
    if (r.areaId) staffByArea[r.areaId] = r._count._all;
  });

  return {
    total,
    inPayroll,
    withSalary,
    areasTotal,
    staffByArea,
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

/**
 * "Ya volvió": la persona deja de figurar de licencia o de vacaciones y pasa a Activo, sin fecha de vuelta.
 * Queda en Auditoría.
 */
export async function markBackFromLeave(user: { id?: string | null; role?: string | null }, id: string) {
  if (!user.id || !canEditHR(user.role)) {
    return { success: false as const, error: "Solo Superadmin y Administración General cambian el estado del personal." };
  }
  const record = await prisma.hRRecord.findUnique({ where: { id }, select: { firstName: true, lastName: true, status: true } });
  if (!record) return { success: false as const, error: "No se encontró a esa persona en Recursos Humanos." };
  if (record.status !== "LICENCIA" && record.status !== "VACACIONES") {
    return { success: false as const, error: "Esa persona ya no figura de licencia. Recargá la página." };
  }
  const { count } = await prisma.hRRecord.updateMany({
    where: { id, status: record.status },
    data: { status: "ACTIVO", statusUntil: null },
  });
  if (count === 0) return { success: false as const, error: "Otra persona cambió el estado recién. Recargá la página." };
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "HR_VOLVIO",
      entity: "HRRecord",
      entityId: id,
      details: `${record.lastName}, ${record.firstName} volvió de ${record.status === "VACACIONES" ? "las vacaciones" : "la licencia"}: pasa a Activo.`,
    },
  });
  return { success: true as const };
}
