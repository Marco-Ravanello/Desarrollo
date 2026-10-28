// Quién da altas y bajas en cada programa del padrón. Sin acceso a la base: se usa en pantalla y en el servidor.
import type { Role } from "@prisma/client";
import { canManageProgramEnrollment, MANAGEMENT_ROLES } from "@/lib/permissions";

type Viewer = { role?: Role | string | null; areaId?: string | null };

/** Elegir qué área tiene a cargo cada programa: la conducción. */
export function canAssignProgramArea(role?: Role | string | null): boolean {
  return Boolean(role) && MANAGEMENT_ROLES.includes(role as Role);
}

/**
 * ¿Puede dar altas y bajas en este programa? La conducción, en todos. El resto (si su rol carga datos
 * sociales), solo en los programas de su área. Un programa sin área a cargo lo maneja cualquiera que
 * carga datos, como antes de que existiera esta regla.
 */
export function canManageProgram(viewer: Viewer, ownerAreaId: string | null | undefined): boolean {
  if (!canManageProgramEnrollment(viewer.role)) return false;
  if (canAssignProgramArea(viewer.role)) return true;
  if (!ownerAreaId) return true;
  return Boolean(viewer.areaId) && viewer.areaId === ownerAreaId;
}

/**
 * ¿Puede ver la lista de posibles destinatarios? Quien da altas en el programa y la conducción.
 * La lista sale de cruzar el padrón con los expedientes, así que no la ve cualquiera.
 */
export function canViewProgramCandidates(viewer: Viewer, ownerAreaId: string | null | undefined): boolean {
  return canAssignProgramArea(viewer.role) || canManageProgram(viewer, ownerAreaId);
}
