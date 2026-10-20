import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canCloseOrReopenCase, caseReasonProblem } from "@/lib/case-closing";

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
