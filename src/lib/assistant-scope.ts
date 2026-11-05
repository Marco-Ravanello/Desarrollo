// Qué datos puede ver el asistente según quien pregunta. Sigue las mismas reglas que el resto de la app:
// - Las pantallas que el rol no puede abrir (por ejemplo Recursos Humanos para un Director de Área) tampoco
//   se consultan desde el asistente.
// - El Director de Área ve los expedientes, las compras, los convenios, el stock, los programas y los cursos de su
//   área, como en su Inicio. El padrón (personas y barrios) y los vehículos son de todas las áreas.
// - Violencia de Género solo con el permiso para verla.
// Sin base de datos, para poder probarlo solo.
import type { Prisma } from "@prisma/client";
import { canAccessPath, hasPermission, PERMISSIONS } from "@/lib/permissions";

/** Un área que no existe: un Director sin área cargada no ve datos de ninguna. */
export const NO_AREA = "__sin_area__";

export interface AssistantScope {
  userId: string | null;
  role: string | null;
  /** El área a la que se limitan los datos (solo para el Director de Área); null = todas. */
  areaId: string | null;
  limitedToArea: boolean;
  canViewSensitive: boolean;
}

export function buildAssistantScope(user: { id?: string | null; role?: string | null; areaId?: string | null }): AssistantScope {
  const limitedToArea = user.role === "DIRECTOR_AREA";
  return {
    userId: user.id ?? null,
    role: user.role ?? null,
    areaId: limitedToArea ? user.areaId || NO_AREA : null,
    limitedToArea,
    canViewSensitive: Boolean(user.role) && hasPermission(user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES),
  };
}

/** ¿Puede ver la pantalla de donde salen esos datos? */
export function scopeCanSee(scope: AssistantScope, path: string | null): boolean {
  return path === null || canAccessPath(scope.role, path);
}

/** El Director de Área sin un área cargada en su usuario. */
export function scopeWithoutArea(scope: AssistantScope): boolean {
  return scope.limitedToArea && scope.areaId === NO_AREA;
}

const VIOLENCE_AREA = { name: { contains: "violencia", mode: "insensitive" as const } };

/** Expedientes que puede ver: los de su área si es Director, y sin Violencia de Género si no tiene permiso. */
export function scopedCaseWhere(scope: AssistantScope): Prisma.CaseWhereInput {
  const where: Prisma.CaseWhereInput = {};
  if (scope.areaId) where.areaId = scope.areaId;
  if (!scope.canViewSensitive) where.NOT = { area: VIOLENCE_AREA };
  return where;
}

/** Áreas que se muestran en tablas y gráficos. */
export function scopedAreaWhere(scope: AssistantScope): Prisma.AreaWhereInput {
  const where: Prisma.AreaWhereInput = {};
  if (scope.areaId) where.id = scope.areaId;
  if (!scope.canViewSensitive) where.NOT = VIOLENCE_AREA;
  return where;
}

/**
 * Para lo que tiene un área (órdenes, convenios, stock, cursos): la suya si es Director.
 * Con `includeShared`, también lo que no tiene área (el stock y los cursos para todas).
 */
export function scopedAreaIdWhere(scope: AssistantScope, includeShared = false): { areaId?: string | null } | { OR: { areaId: string | null }[] } {
  if (!scope.areaId) return {};
  return includeShared ? { OR: [{ areaId: scope.areaId }, { areaId: null }] } : { areaId: scope.areaId };
}

/** Un programa a cargo de un área: el Director ve los de su área y los que no tienen área. */
export function programVisible(scope: AssistantScope, ownerAreaId: string | null | undefined): boolean {
  return !scope.areaId || !ownerAreaId || ownerAreaId === scope.areaId;
}

/** La frase que se agrega cuando la respuesta está limitada al área. */
export const AREA_NOTE = "Te muestro solo los datos de tu área.";

export const NO_AREA_ANSWER =
  "Tu usuario no tiene un área cargada, así que no puedo mostrarte datos de un área. Pedile al Superadmin que te la asigne.";

export const MANAGEMENT_ONLY_ANSWER =
  "Esa información la ve solo la conducción (Superadmin, Dirección General y Administración General), como en el resto de la app.";
