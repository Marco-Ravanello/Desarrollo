import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canCloseOrReopenCase, caseReasonProblem } from "@/lib/case-closing";
import { UNDONE_ACTIONS, UNDO_TOO_LATE, withinUndoWindow } from "@/lib/undo";

// Cerrar y reabrir un expediente, siempre con un motivo que queda en la historia.

export { canCloseOrReopenCase };

type CaseUser = { id: string; role: Role };
type Result = { success: true } | { success: false; error: string };
const fail = (error: string): Result => ({ success: false, error });

async function findCase(caseId: string) {
  return prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, area: { select: { name: true } } },
  });
}

export async function closeCase(user: CaseUser, input: { caseId: string; reason: string }): Promise<Result> {
  const problem = caseReasonProblem(input.reason, "cerrar");
  if (problem) return fail(problem);
  const caseItem = await findCase(input.caseId);
  if (!caseItem) return fail("Expediente no encontrado.");
  if (!canCloseOrReopenCase(user, caseItem.area?.name)) return fail("Tu rol no puede cerrar este expediente.");
  if (caseItem.status === "CERRADO") return fail("El expediente ya está cerrado.");
  const pending = await prisma.derivation.count({ where: { caseId: caseItem.id, status: "PENDIENTE" } });
  if (pending) return fail("Tiene una derivación sin responder. Primero hay que aceptarla o rechazarla.");

  // Solo cierra si nadie lo cerró mientras tanto.
  const updated = await prisma.case.updateMany({ where: { id: caseItem.id, status: { not: "CERRADO" } }, data: { status: "CERRADO" } });
  if (updated.count === 0) return fail("El expediente ya está cerrado.");
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CLOSE_CASE", entity: "Case", entityId: caseItem.id, details: `Motivo: ${input.reason.trim()}` },
  });
  return { success: true };
}

export async function reopenCase(user: CaseUser, input: { caseId: string; reason: string }): Promise<Result> {
  const problem = caseReasonProblem(input.reason, "reabrir");
  if (problem) return fail(problem);
  const caseItem = await findCase(input.caseId);
  if (!caseItem) return fail("Expediente no encontrado.");
  if (!canCloseOrReopenCase(user, caseItem.area?.name)) return fail("Tu rol no puede reabrir este expediente.");
  if (caseItem.status !== "CERRADO") return fail("El expediente no está cerrado.");

  const updated = await prisma.case.updateMany({ where: { id: caseItem.id, status: "CERRADO" }, data: { status: "ABIERTO" } });
  if (updated.count === 0) return fail("El expediente ya se reabrió.");
  await prisma.auditLog.create({
    data: { userId: user.id, action: "REOPEN_CASE", entity: "Case", entityId: caseItem.id, details: `Motivo: ${input.reason.trim()}` },
  });
  return { success: true };
}

/**
 * Deshace un cierre recién hecho (idea 141): vuelve a quedar abierto como estaba. Solo quien lo cerró,
 * en los primeros minutos y si nadie hizo nada con el expediente desde entonces. La entrada de Auditoría
 * queda, como "cierre deshecho", y deja de aparecer en la historia del expediente.
 */
export async function undoCloseCase(user: CaseUser, caseId: string, now = new Date()): Promise<Result> {
  const caseItem = await findCase(caseId);
  if (!caseItem) return fail("Expediente no encontrado.");
  if (!canCloseOrReopenCase(user, caseItem.area?.name)) return fail("Tu rol no puede reabrir este expediente.");
  if (caseItem.status !== "CERRADO") return fail("El expediente ya no está cerrado.");
  const last = await prisma.auditLog.findFirst({
    where: { entity: "Case", entityId: caseId },
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, userId: true, createdAt: true },
  });
  if (!last || last.action !== "CLOSE_CASE" || last.userId !== user.id) return fail("Solo se puede deshacer un cierre que acabás de hacer.");
  if (!withinUndoWindow(last.createdAt, now)) return fail(UNDO_TOO_LATE);
  const later = await prisma.intervention.count({ where: { caseId, createdAt: { gt: last.createdAt } } });
  if (later) return fail("Ya se cargó algo en el expediente después del cierre. Reabrilo con un motivo.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.case.updateMany({ where: { id: caseId, status: "CERRADO" }, data: { status: "ABIERTO" } });
    if (updated.count === 0) return fail("El expediente ya no está cerrado.");
    await tx.auditLog.update({ where: { id: last.id }, data: { action: UNDONE_ACTIONS.CLOSE_CASE } });
    return { success: true } as Result;
  });
}
