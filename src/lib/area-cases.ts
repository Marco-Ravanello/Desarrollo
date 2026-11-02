import type { Prisma } from "@prisma/client";
import { ACTIVE_CASE_STATUSES } from "@/lib/case-urgency";

/**
 * Filtros de la lista de expedientes de las páginas de área (Protección Social, Niñez,
 * Hábitat, Violencia). Viven en la dirección (?pestana=&prioridad=&q=&page=&limit=) para que
 * la lista se pida por páginas al servidor y no se traigan todos los expedientes juntos.
 */

/** Las cuatro páginas de área y las palabras con las que se encuentra su área en la base. */
export const AREA_PAGES = {
  social: {
    title: "Protección Social",
    description: "Ayudas urgentes, módulos alimentarios, emergencias climáticas y subsidios a familias.",
    themeColor: "emerald",
    sensitive: false,
    keywords: ["Protección Social", "Proteccion Social", "Social"],
  },
  ninez: {
    title: "Niñez, Adolescencia y Familia",
    description: "Protección de los derechos de chicos, chicas y adolescentes, y apoyo a sus familias.",
    themeColor: "amber",
    sensitive: false,
    keywords: ["Niñez", "Ninez", "Adolescencia", "Familia"],
  },
  habitat: {
    title: "Hábitat y Vivienda",
    description: "Regularización de terrenos, escrituras, mejoras de vivienda y obras en los barrios.",
    themeColor: "blue",
    sensitive: false,
    keywords: ["Vivienda", "Regularización", "Hábitat", "Habitat"],
  },
  violence: {
    title: "Violencia de Género",
    description: "Acompañamiento, medidas de protección, alojamiento y asistencia psicológica a quienes sufren violencia.",
    themeColor: "rose",
    sensitive: true,
    keywords: ["Violencia", "Mujeres", "Género", "Genero"],
  },
} as const;

export type AreaPageSlug = keyof typeof AREA_PAGES;

export function isAreaPageSlug(value: unknown): value is AreaPageSlug {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AREA_PAGES, value);
}

export const AREA_CASE_TABS = ["ACTIVOS", "EN_PROCESO", "DERIVADOS", "CERRADOS", "TODOS"] as const;
export type AreaCaseTab = (typeof AREA_CASE_TABS)[number];

export const AREA_CASE_PRIORITIES = ["URGENTE", "ALTA", "MEDIA", "BAJA"] as const;
export type AreaCasePriority = (typeof AREA_CASE_PRIORITIES)[number];

export const AREA_PAGE_SIZES = [15, 20, 30, 50] as const;
export const AREA_DEFAULT_PAGE_SIZE = 20;
/** Tope de filas al exportar la lista filtrada. */
export const AREA_EXPORT_MAX_ROWS = 5000;

export interface AreaCaseFilters {
  tab: AreaCaseTab;
  priority: AreaCasePriority | null;
  q: string;
  page: number;
  limit: number;
}

type RawParams = Record<string, string | string[] | undefined> | undefined | null;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Lee los filtros de la dirección. Cualquier valor raro vuelve al valor por defecto. */
export function parseAreaCaseFilters(params: RawParams): AreaCaseFilters {
  const p = params ?? {};
  const tabRaw = first(p.pestana)?.toUpperCase();
  const tab = (AREA_CASE_TABS as readonly string[]).includes(tabRaw ?? "") ? (tabRaw as AreaCaseTab) : "ACTIVOS";

  const prioRaw = first(p.prioridad)?.toUpperCase();
  const priority = (AREA_CASE_PRIORITIES as readonly string[]).includes(prioRaw ?? "")
    ? (prioRaw as AreaCasePriority)
    : null;

  const q = (first(p.q) ?? "").trim().slice(0, 100);

  const pageNum = Number.parseInt(first(p.page) ?? "", 10);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(pageNum, 100000) : 1;

  const limitNum = Number.parseInt(first(p.limit) ?? "", 10);
  const limit = (AREA_PAGE_SIZES as readonly number[]).includes(limitNum) ? limitNum : AREA_DEFAULT_PAGE_SIZE;

  return { tab, priority, q, page, limit };
}

/** Qué estados entran en cada pestaña ("Activos" = abiertos y en proceso, igual que en el resto de la app). */
export function areaTabStatusWhere(tab: AreaCaseTab): Prisma.CaseWhereInput {
  switch (tab) {
    case "ACTIVOS":
      return { status: { in: [...ACTIVE_CASE_STATUSES] } };
    case "EN_PROCESO":
      return { status: "EN_PROCESO" };
    case "DERIVADOS":
      return { status: "DERIVADO" };
    case "CERRADOS":
      return { status: "CERRADO" };
    default:
      return {};
  }
}

/** Condición completa de la lista de un área con sus filtros (pestaña, prioridad y búsqueda). */
export function areaCaseListWhere(areaId: string, filters: Pick<AreaCaseFilters, "tab" | "priority" | "q">): Prisma.CaseWhereInput {
  const where: Prisma.CaseWhereInput = { areaId, ...areaTabStatusWhere(filters.tab) };
  if (filters.priority) where.priority = filters.priority;
  const q = filters.q.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { person: { firstName: { contains: q, mode: "insensitive" } } },
      { person: { lastName: { contains: q, mode: "insensitive" } } },
      { person: { dni: { contains: q } } },
    ];
  }
  return where;
}

/** Arma la dirección de la página del área con los filtros que no son los de por defecto. */
export function areaCaseListQuery(filters: Partial<AreaCaseFilters>): string {
  const params = new URLSearchParams();
  if (filters.tab && filters.tab !== "ACTIVOS") params.set("pestana", filters.tab.toLowerCase());
  if (filters.priority) params.set("prioridad", filters.priority.toLowerCase());
  if (filters.q && filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit && filters.limit !== AREA_DEFAULT_PAGE_SIZE) params.set("limit", String(filters.limit));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** La página de Violencia de Género la abren solo estos roles (además del permiso de casos sensibles). */
export const VIOLENCE_PAGE_ROLES = ["SUPERADMIN", "DIRECCION_GENERAL", "VIOLENCIA_GENERO"] as const;

export function canOpenAreaPage(role: string | null | undefined, slug: AreaPageSlug, canAccess: (path: string) => boolean): boolean {
  if (!role) return false;
  if (!canAccess(`/areas/${slug}`)) return false;
  if (slug === "violence") return (VIOLENCE_PAGE_ROLES as readonly string[]).includes(role);
  return true;
}
