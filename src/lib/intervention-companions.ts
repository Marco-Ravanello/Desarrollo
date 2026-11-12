import type { Role } from "@prisma/client";
import { canEditSocialRecords, hasPermission, isEmergencySurveyor, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";

// Intervenciones hechas entre varios profesionales ("fuimos con Lucía"), idea 124. Reglas sin base de datos.

/** Cuántos compañeros se pueden sumar a una intervención (además de quien la carga). */
export const MAX_COMPANIONS = 4;

/**
 * Quién puede figurar como compañero: quien carga intervenciones (no Auditoría ni el relevador).
 * En un expediente de Violencia de Género, solo quien puede ver esos expedientes.
 */
export function canAccompany(role: Role, caseAreaName: string | null | undefined): boolean {
  if (!canEditSocialRecords(role) || isEmergencySurveyor(role)) return false;
  return !isSensitiveArea(caseAreaName) || hasPermission(role, PERMISSIONS.VIEW_SENSITIVE_CASES);
}

/**
 * Limpia la lista que llega del formulario: sin repetidos, sin quien la carga y solo personas permitidas.
 * Devuelve un error si hay alguien que no se puede sumar o si son demasiados.
 */
export function checkCompanions(
  input: unknown,
  authorId: string,
  allowedIds: Set<string>
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (input == null) return { ok: true, ids: [] };
  if (!Array.isArray(input)) return { ok: false, error: "No se entendió con quién fue la intervención." };
  const ids = Array.from(new Set(input.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()))).filter(
    (id) => id !== authorId
  );
  if (ids.length > MAX_COMPANIONS) return { ok: false, error: `Podés sumar hasta ${MAX_COMPANIONS} personas por intervención.` };
  if (ids.some((id) => !allowedIds.has(id))) {
    return { ok: false, error: "Alguna de las personas elegidas no puede figurar en esta intervención. Recargá la página y elegí de nuevo." };
  }
  return { ok: true, ids };
}

/** "Con Lucía Gómez", "Con Lucía Gómez y Martín Pérez", "Con A, B y C". */
export function companionsText(names: string[]): string {
  const list = names.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return `Con ${list[0]}`;
  return `Con ${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}
