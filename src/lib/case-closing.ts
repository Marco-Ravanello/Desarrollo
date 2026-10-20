import type { Role } from "@prisma/client";
import { canEditSocialRecords, hasPermission, isEmergencySurveyor, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";

// Reglas para cerrar y reabrir un expediente (sin base de datos).

export const CASE_REASON_MAX = 1000;

/** Cierran y reabren quienes cargan expedientes (no Auditoría ni el relevador); los de Violencia de Género, solo quien puede verlos. */
export function canCloseOrReopenCase(user: { role: Role }, caseAreaName: string | null | undefined): boolean {
  if (!canEditSocialRecords(user.role) || isEmergencySurveyor(user.role)) return false;
  return !isSensitiveArea(caseAreaName) || hasPermission(user.role, PERMISSIONS.VIEW_SENSITIVE_CASES);
}

/** Qué le falta al motivo, o null si está bien. */
export function caseReasonProblem(reason: string | null | undefined, action: "cerrar" | "reabrir"): string | null {
  const clean = reason?.trim() ?? "";
  if (!clean) return `Escribí el motivo para ${action} el expediente.`;
  if (clean.length > CASE_REASON_MAX) return `El motivo puede tener hasta ${CASE_REASON_MAX} caracteres.`;
  return null;
}

/** El motivo guardado en la auditoría ("Motivo: ..."); null en los cierres viejos, que no lo tenían. */
export function reasonFromDetails(details: string | null | undefined): string | null {
  const m = details?.match(/^Motivo: ([\s\S]+)$/);
  return m ? m[1].trim() : null;
}
