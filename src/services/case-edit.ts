import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canEditCase, checkCaseEdit, type CaseEditInput } from "@/lib/case-edit";

type Actor = { id?: string | null; role?: string | null };
type Result = { success: true; changed: boolean } | { success: false; error: string };

/**
 * Corrige la carátula, la descripción o la prioridad de un expediente abierto (idea 121).
 * Lo que cambió queda en la historia del expediente (Auditoría, acción CASE_EDIT), con la descripción anterior.
 */
export async function updateCaseDetails(user: Actor, caseId: string, input: CaseEditInput): Promise<Result> {
  if (!user.id || !user.role) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  const caseItem = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, title: true, description: true, priority: true, status: true, area: { select: { name: true } } },
  });
  if (!caseItem) return { success: false, error: "No se encontró el expediente." };
  if (!canEditCase({ role: user.role as Role }, { status: caseItem.status, areaName: caseItem.area?.name })) {
    return {
      success: false,
      error: caseItem.status === "CERRADO" ? "El expediente está cerrado. Reabrilo para corregirlo." : "Tu rol no puede corregir este expediente.",
    };
  }

  const check = checkCaseEdit(caseItem, input);
  if (!check.ok) return { success: false, error: check.error };
  if (!check.changed) return { success: true, changed: false };

  const saved = await prisma.$transaction(async (tx) => {
    // Si otra persona lo cambió mientras tanto, no se pisa lo suyo.
    const { count } = await tx.case.updateMany({
      where: { id: caseId, title: caseItem.title, description: caseItem.description, priority: caseItem.priority, status: { not: "CERRADO" } },
      data: check.data,
    });
    if (count === 0) return false;
    await tx.auditLog.create({
      data: { userId: user.id!, action: "CASE_EDIT", entity: "Case", entityId: caseId, details: check.details },
    });
    return true;
  });
  if (!saved) return { success: false, error: "Otra persona cambió el expediente recién. Recargá la página y probá de nuevo." };
  return { success: true, changed: true };
}
