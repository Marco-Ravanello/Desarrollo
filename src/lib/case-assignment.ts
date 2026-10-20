import type { Role } from "@prisma/client";
import { MANAGEMENT_ROLES, canEditSocialRecords, hasPermission, isEmergencySurveyor, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";

// Reglas del profesional a cargo de un expediente (sin base de datos).

/** Asigna o cambia el profesional de cualquier persona: conducción, o Director de Área de su propia área. */
export function canAssignCase(user: { role: Role; areaId?: string | null }, caseAreaId: string): boolean {
  if (MANAGEMENT_ROLES.includes(user.role)) return true;
  return user.role === "DIRECTOR_AREA" && user.areaId === caseAreaId;
}

/** Puede quedar a cargo de un expediente sin profesional: alguien del área que carga datos sociales. */
export function canTakeCase(user: { role: Role; areaId?: string | null }, caseAreaId: string): boolean {
  return canEditSocialRecords(user.role) && !isEmergencySurveyor(user.role) && user.areaId === caseAreaId;
}

/** Quién puede quedar a cargo: usuarios activos del área (o de la conducción) que puedan ver el expediente. */
export function isEligibleAssignee(
  candidate: { role: Role; areaId: string | null; isActive: boolean },
  caseItem: { areaId: string; areaName: string | null }
): boolean {
  if (!candidate.isActive) return false;
  if (candidate.role === "AUDITOR" || isEmergencySurveyor(candidate.role)) return false;
  if (isSensitiveArea(caseItem.areaName) && !hasPermission(candidate.role, PERMISSIONS.VIEW_SENSITIVE_CASES)) return false;
  return candidate.areaId === caseItem.areaId || MANAGEMENT_ROLES.includes(candidate.role);
}
