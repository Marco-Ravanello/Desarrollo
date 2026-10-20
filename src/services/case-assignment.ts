import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { canAssignCase, canTakeCase, isEligibleAssignee } from "@/lib/case-assignment";

// Profesional a cargo de un expediente: la conducción y quien dirige el área
// lo asignan o lo cambian; alguien del área puede tomar uno que no tiene a nadie.

export { canAssignCase, canTakeCase, isEligibleAssignee };

export type AssignUser = { id: string; name?: string | null; role: Role; areaId?: string | null };

type Result = { success: true } | { success: false; error: string };
const fail = (error: string): Result => ({ success: false, error });

export async function getAssignableUsers(caseItem: { areaId: string; areaName: string | null }) {
  const users = await prisma.user.findMany({
    where: { isActive: true, OR: [{ areaId: caseItem.areaId }, { role: { in: MANAGEMENT_ROLES } }] },
    select: { id: true, name: true, email: true, role: true, areaId: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return users
    .filter((u) => isEligibleAssignee(u, caseItem))
    .map((u) => ({ id: u.id, name: u.name || u.email || "Usuario", sameArea: u.areaId === caseItem.areaId }));
}

/** Asigna (o quita, con assigneeId null) el profesional a cargo. */
export async function assignCase(user: AssignUser, input: { caseId: string; assigneeId: string | null }): Promise<Result> {
  const caseItem = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: { id: true, title: true, areaId: true, status: true, assignedToId: true, area: { select: { name: true } }, assignedTo: { select: { name: true } } },
  });
  if (!caseItem) return fail("Expediente no encontrado.");
  if (caseItem.status === "CERRADO") return fail("El expediente está cerrado.");
  if (caseItem.assignedToId === input.assigneeId) return { success: true };

  const isSelfTake = input.assigneeId === user.id && !caseItem.assignedToId && canTakeCase(user, caseItem.areaId);
  if (!isSelfTake && !canAssignCase(user, caseItem.areaId)) {
    return fail("Solo la conducción o quien dirige el área puede asignar o cambiar el profesional a cargo.");
  }

  let assignee: { id: string; name: string | null } | null = null;
  if (input.assigneeId) {
    const found = await prisma.user.findUnique({
      where: { id: input.assigneeId },
      select: { id: true, name: true, email: true, role: true, areaId: true, isActive: true },
    });
    if (!found || !isEligibleAssignee(found, { areaId: caseItem.areaId, areaName: caseItem.area?.name ?? null })) {
      return fail("Esa persona no puede quedar a cargo de este expediente.");
    }
    assignee = { id: found.id, name: found.name || found.email || "Usuario" };
  }

  // Solo cambia si nadie lo cambió mientras tanto.
  const updated = await prisma.case.updateMany({
    where: { id: caseItem.id, assignedToId: caseItem.assignedToId },
    data: { assignedToId: assignee?.id ?? null, assignedAt: assignee ? new Date() : null },
  });
  if (updated.count === 0) return fail("Alguien cambió el profesional a cargo recién. Recargá la página.");

  if (assignee && assignee.id !== user.id) {
    await prisma.notification.create({
      data: {
        userId: assignee.id,
        title: "Te asignaron un expediente",
        message: `${user.name || "Alguien"} te dejó a cargo del expediente "${caseItem.title}" (${caseItem.area?.name || "sin área"}).`,
        link: `/cases/${caseItem.id}`,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "ASSIGN_CASE",
      entity: "Case",
      entityId: caseItem.id,
      details: assignee
        ? `Quedó a cargo de ${assignee.name}${caseItem.assignedTo?.name ? ` (antes: ${caseItem.assignedTo.name})` : ""}.`
        : `Quedó sin profesional a cargo${caseItem.assignedTo?.name ? ` (antes: ${caseItem.assignedTo.name})` : ""}.`,
    },
  });
  return { success: true };
}

/** Expedientes abiertos que tiene a cargo la persona (para "Mis expedientes"). */
export async function countMyOpenCases(userId: string): Promise<number> {
  return prisma.case.count({ where: { assignedToId: userId, status: { not: "CERRADO" } } });
}
