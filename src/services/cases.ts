import prisma from "@/lib/prisma";
import { CASE_STATUS_LABEL, summarizeCase } from "@/lib/case-summary";

export async function getCasesByArea(areaName: string) {
  return await prisma.case.findMany({
    where: {
      area: { name: areaName }
    },
    include: {
      person: true,
      interventions: {
        orderBy: { date: 'desc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
}

export async function createCase(data: any) {
  return await prisma.case.create({
    data: {
      personId: data.personId,
      areaId: data.areaId,
      title: data.title,
      description: data.description,
      status: 'ABIERTO',
      priority: data.priority || 'MEDIA'
    }
  });
}

export async function getAreas() {
  return await prisma.area.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function getCaseById(id: string) {
  if (!id) return null;
  try {
    return await prisma.case.findUnique({
      where: { id },
      include: {
        person: true,
        area: true,
        interventions: {
          orderBy: { date: 'desc' }
        },
        documents: true,
        assignedTo: { select: { id: true, name: true, email: true } }
      }
    });
  } catch (error) {
    console.error(`Error in getCaseById for id=${id}:`, error);
    return null;
  }
}

export async function getAreaDashboardData(areaKeywords: string[]) {
  const allAreas = await prisma.area.findMany();
  const matchingArea = allAreas.find((a) =>
    areaKeywords.some((keyword) =>
      a.name.toLowerCase().includes(keyword.toLowerCase())
    )
  );

  if (!matchingArea) {
    return {
      area: null,
      cases: [],
      stats: {
        totalCases: 0,
        activeCases: 0,
        urgentCases: 0,
        monthlyInterventions: 0,
        uniquePersons: 0
      }
    };
  }

  const cases = await prisma.case.findMany({
    where: {
      areaId: matchingArea.id
    },
    include: {
      person: true,
      interventions: {
        orderBy: { date: 'desc' },
        take: 1
      },
      _count: {
        select: {
          interventions: true,
          documents: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const totalCases = cases.length;
  const activeCases = cases.filter(
    (c) => c.status === 'ABIERTO' || c.status === 'EN_PROCESO'
  ).length;
  const urgentCases = cases.filter(
    (c) => c.priority === 'URGENTE' || c.priority === 'ALTA'
  ).length;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyInterventionsCount = await prisma.intervention.count({
    where: {
      case: {
        areaId: matchingArea.id
      },
      date: {
        gte: startOfMonth
      }
    }
  });

  const uniquePersonIds = new Set(cases.map((c) => c.personId));

  return {
    area: matchingArea,
    cases,
    stats: {
      totalCases,
      activeCases,
      urgentCases,
      monthlyInterventions: monthlyInterventionsCount,
      uniquePersons: uniquePersonIds.size
    }
  };
}

export async function updateCaseStatus(id: string, status?: string, priority?: string) {
  const data: any = {};
  if (status) data.status = status;
  if (priority) data.priority = priority;

  return await prisma.case.update({
    where: { id },
    data
  });
}

export interface GetCasesFilters {
  query?: string;
  areaId?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
  canViewSensitive?: boolean;
  /** "mine": a cargo de `userId`; "none": sin profesional a cargo. */
  assigned?: "mine" | "none";
  userId?: string;
}

export async function getAllCases(filters: GetCasesFilters = {}) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 20));
  const skip = (page - 1) * limit;
  const where: any = {};

  if (!filters.canViewSensitive) {
    // Prisma no acepta `mode` dentro de `not`; se excluye el área con NOT.
    where.NOT = { area: { name: { contains: "violencia", mode: "insensitive" } } };
  }

  if (filters.areaId && filters.areaId !== "all") {
    where.areaId = filters.areaId;
  }
  if (filters.status === "ACTIVOS") {
    // Abiertos y en proceso: lo mismo que cuenta "Casos activos" en el Dashboard.
    where.status = { in: ["ABIERTO", "EN_PROCESO"] };
  } else if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }
  if (filters.priority && filters.priority !== "all") {
    where.priority = filters.priority;
  }
  if (filters.assigned === "mine" && filters.userId) {
    where.assignedToId = filters.userId;
  } else if (filters.assigned === "none") {
    where.assignedToId = null;
  }
  if (filters.query && filters.query.trim()) {
    const q = filters.query.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { person: { firstName: { contains: q, mode: "insensitive" } } },
      { person: { lastName: { contains: q, mode: "insensitive" } } },
      { person: { dni: { contains: q } } },
    ];
  }

  const [cases, total, totalActive, totalUrgent, totalClosed] = await Promise.all([
    prisma.case.findMany({
      where,
      include: {
        person: true,
        area: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        interventions: {
          orderBy: { date: "desc" },
          take: 1,
        },
        _count: {
          select: { interventions: true, documents: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.case.count({ where }),
    prisma.case.count({ where: { ...where, status: { in: ["ABIERTO", "EN_PROCESO"] } } }),
    prisma.case.count({ where: { ...where, priority: "URGENTE", status: { in: ["ABIERTO", "EN_PROCESO"] } } }),
    prisma.case.count({ where: { ...where, status: "CERRADO" } }),
  ]);

  return {
    cases,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    pageSize: limit,
    stats: {
      totalAll: total,
      active: totalActive,
      urgent: totalUrgent,
      closed: totalClosed,
    },
  };
}

export interface MyAssignedCase {
  id: string;
  title: string;
  titular: string | null;
  status: string;
  /** Días sin movimiento (desde la última intervención o la apertura). */
  quietDays: number;
  stale: boolean;
}

/** Expedientes sin cerrar a cargo de este usuario: primero los que llevan más tiempo quietos. */
export async function getMyAssignedCases(userId: string, limit = 5): Promise<{ total: number; cases: MyAssignedCase[] }> {
  const rows = await prisma.case.findMany({
    where: { assignedToId: userId, status: { not: "CERRADO" } },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      person: { select: { firstName: true, lastName: true } },
      interventions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });
  const cases = rows
    .map((c) => {
      const summary = summarizeCase({ status: c.status, createdAt: c.createdAt, lastInterventionAt: c.interventions[0]?.date ?? null });
      return {
        id: c.id,
        title: c.title,
        titular: c.person ? `${c.person.lastName}, ${c.person.firstName}` : null,
        status: CASE_STATUS_LABEL[c.status] ?? c.status,
        quietDays: summary.quietDays,
        stale: summary.stale,
      };
    })
    .sort((a, b) => b.quietDays - a.quietDays || a.title.localeCompare(b.title, "es"));
  return { total: cases.length, cases: cases.slice(0, limit) };
}
