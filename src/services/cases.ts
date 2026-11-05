import prisma from "@/lib/prisma";
import { CASE_STATUS_LABEL, staleCutoff, summarizeCase } from "@/lib/case-summary";
import { pickAreaByKeywords } from "@/lib/area-theme";
import { isCaseLabel, normalizeCaseLabels } from "@/lib/case-labels";
import { ACTIVE_CASE_STATUSES, URGENT_OPEN_CASE_WHERE } from "@/lib/case-urgency";
import { AREA_EXPORT_MAX_ROWS, areaCaseListWhere, parseAreaCaseFilters, type AreaCaseFilters } from "@/lib/area-cases";
import type { Prisma } from "@prisma/client";
import { nombrePropio, personaPropia } from "@/lib/nombres";

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
      priority: data.priority || 'MEDIA',
      labels: normalizeCaseLabels(data.labels),
    }
  });
}

export async function getAreas() {
  const areas = await prisma.area.findMany({
    orderBy: { name: 'asc' }
  });
  // El presupuesto (Decimal) va como número común para poder pasarlo a pantallas del navegador.
  return areas.map((a) => ({ ...a, annualBudget: Number(a.annualBudget) }));
}

export async function getCaseById(id: string) {
  if (!id) return null;
  try {
    const found = await prisma.case.findUnique({
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
    // Nombre del titular con mayúscula inicial (solo para mostrar).
    return found && found.person ? { ...found, person: personaPropia(found.person) } : found;
  } catch (error) {
    console.error(`Error in getCaseById for id=${id}:`, error);
    return null;
  }
}

/** Lo que necesita la lista de un área: el expediente, su titular y cuántas intervenciones tiene. */
const AREA_CASE_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  updatedAt: true,
  createdAt: true,
  person: { select: { id: true, dni: true, firstName: true, lastName: true } },
  _count: { select: { interventions: true } },
} satisfies Prisma.CaseSelect;

export type AreaCaseRow = Prisma.CaseGetPayload<{ select: typeof AREA_CASE_SELECT }>;

async function findAreaByKeywords(areaKeywords: readonly string[]) {
  const allAreas = await prisma.area.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
  return pickAreaByKeywords(allAreas, [...areaKeywords]);
}

/**
 * Página de un área: cifras contadas en la base y una sola página de expedientes según los
 * filtros de la dirección (pestaña, prioridad, búsqueda). No trae todos los expedientes juntos.
 */
export async function getAreaDashboardData(
  areaKeywords: readonly string[],
  filters: AreaCaseFilters = parseAreaCaseFilters({})
) {
  const matchingArea = await findAreaByKeywords(areaKeywords);

  const emptyStats = {
    totalCases: 0,
    activeCases: 0,
    urgentCases: 0,
    monthlyInterventions: 0,
    uniquePersons: 0,
  };

  if (!matchingArea) {
    return { area: null, cases: [] as AreaCaseRow[], total: 0, totalPages: 0, currentPage: 1, pageSize: filters.limit, stats: emptyStats };
  }

  const areaId = matchingArea.id;
  const listWhere = areaCaseListWhere(areaId, filters);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, totalCases, activeCases, urgentCases, monthlyInterventions, persons] = await Promise.all([
    prisma.case.count({ where: listWhere }),
    prisma.case.count({ where: { areaId } }),
    prisma.case.count({ where: { areaId, status: { in: [...ACTIVE_CASE_STATUSES] } } }),
    prisma.case.count({ where: { areaId, ...URGENT_OPEN_CASE_WHERE } }),
    prisma.intervention.count({ where: { case: { areaId }, date: { gte: startOfMonth } } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "personId")::bigint AS n FROM "Case" WHERE "areaId" = ${areaId}`,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const currentPage = Math.min(filters.page, totalPages);

  const cases = await prisma.case.findMany({
    where: listWhere,
    select: AREA_CASE_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: (currentPage - 1) * filters.limit,
    take: filters.limit,
  });

  return {
    area: matchingArea,
    cases,
    total,
    totalPages,
    currentPage,
    pageSize: filters.limit,
    stats: {
      totalCases,
      activeCases,
      urgentCases,
      monthlyInterventions,
      uniquePersons: Number(persons[0]?.n ?? 0),
    },
  };
}

/** Todos los expedientes de un área que cumplen los filtros (para exportar), hasta un tope. */
export async function getAreaCasesForExport(areaKeywords: readonly string[], filters: Pick<AreaCaseFilters, "tab" | "priority" | "q">) {
  const matchingArea = await findAreaByKeywords(areaKeywords);
  if (!matchingArea) return { area: null, cases: [] as AreaCaseRow[], truncated: false };
  const rows = await prisma.case.findMany({
    where: areaCaseListWhere(matchingArea.id, filters),
    select: AREA_CASE_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: AREA_EXPORT_MAX_ROWS + 1,
  });
  return {
    area: matchingArea,
    cases: rows.slice(0, AREA_EXPORT_MAX_ROWS),
    truncated: rows.length > AREA_EXPORT_MAX_ROWS,
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
  /** "mine": a cargo de `userId`; "none": sin profesional a cargo; o el id de un usuario (a cargo de esa persona). */
  assigned?: string;
  userId?: string;
  /** Solo los que no tuvieron intervenciones hace STALE_DAYS días o más (sin cerrar); un número = esos días. */
  quiet?: boolean | number;
  /** Solo los que tuvieron al menos una intervención en los últimos tantos días. */
  moved?: number;
  /** Solo los que tienen esta etiqueta (clave de src/lib/case-labels.ts). */
  label?: string;
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
  } else if (filters.assigned && filters.assigned !== "mine") {
    where.assignedToId = filters.assigned;
  }
  if (filters.label && isCaseLabel(filters.label)) {
    where.labels = { has: filters.label };
  }
  if (filters.quiet) {
    const cutoff = staleCutoff(new Date(), typeof filters.quiet === "number" ? filters.quiet : undefined);
    where.createdAt = { lt: cutoff };
    where.interventions = { none: { date: { gte: cutoff } } };
    if (!where.status) where.status = { not: "CERRADO" };
  } else if (filters.moved) {
    where.interventions = { some: { date: { gte: staleCutoff(new Date(), filters.moved) } } };
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
    prisma.case.count({ where: { ...where, ...URGENT_OPEN_CASE_WHERE } }),
    prisma.case.count({ where: { ...where, status: "CERRADO" } }),
  ]);

  return {
    cases: cases.map((c) => (c.person ? { ...c, person: personaPropia(c.person) } : c)),
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
export async function getMyAssignedCases(userId: string, limit = 5): Promise<{ total: number; stale: number; cases: MyAssignedCase[] }> {
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
        titular: c.person ? nombrePropio(`${c.person.lastName}, ${c.person.firstName}`) : null,
        status: CASE_STATUS_LABEL[c.status] ?? c.status,
        quietDays: summary.quietDays,
        stale: summary.stale,
      };
    })
    .sort((a, b) => b.quietDays - a.quietDays || a.title.localeCompare(b.title, "es"));
  return { total: cases.length, stale: cases.filter((c) => c.stale).length, cases: cases.slice(0, limit) };
}

export type OpenCaseInArea = { id: string; title: string; createdAt: string; assigneeName: string | null };

/**
 * Expedientes abiertos (no cerrados) de una persona en un área, para avisar antes de abrir otro.
 * En Violencia de Género, quien no puede ver esos expedientes solo recibe cuántos hay.
 */
export async function getOpenCasesInArea(
  dni: string,
  areaId: string,
  opts: { canViewSensitive: boolean }
): Promise<{ total: number; cases: OpenCaseInArea[] }> {
  const clean = String(dni || "").trim();
  if (!clean || !areaId) return { total: 0, cases: [] };
  const rows = await prisma.case.findMany({
    where: { areaId, status: { not: "CERRADO" }, person: { dni: clean } },
    select: { id: true, title: true, createdAt: true, area: { select: { name: true } }, assignedTo: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const sensitive = rows.some((r) => (r.area?.name ?? "").toLowerCase().includes("violencia"));
  if (sensitive && !opts.canViewSensitive) return { total: rows.length, cases: [] };
  return {
    total: rows.length,
    cases: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
      assigneeName: r.assignedTo ? r.assignedTo.name || r.assignedTo.email || null : null,
    })),
  };
}
