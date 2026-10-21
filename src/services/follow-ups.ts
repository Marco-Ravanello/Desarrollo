import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canEditSocialRecords, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { fechaCorta } from "@/lib/case-summary";
import { checkFollowUpDay, endOfTodayInArgentina, followUpDueDate, FOLLOW_UP_NOTE_MAX } from "@/lib/follow-up-dates";
import { createNotification } from "@/services/notifications";

// Seguimientos agendados desde un expediente: son tareas de quien las agenda, unidas al
// expediente. El día que vencen le llega un aviso a la campanita.

type FollowUpUser = { id?: string | null; role: Role | string };
type Result = { success: true } | { success: false; error: string };

export interface CaseFollowUp {
  id: string;
  title: string;
  dueDate: string;
  userId: string;
  userName: string | null;
  overdue: boolean;
}

async function caseForUser(user: FollowUpUser, caseId: string) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, title: true, status: true, area: { select: { name: true } } },
  });
  if (!c) return null;
  if (isSensitiveArea(c.area?.name) && !hasPermission(user.role as Role, PERMISSIONS.VIEW_SENSITIVE_CASES)) return null;
  return c;
}

export async function scheduleFollowUp(
  user: FollowUpUser,
  input: { caseId: string; day: string; note?: string | null },
  now = new Date()
): Promise<Result> {
  if (!user.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!canEditSocialRecords(user.role)) return { success: false, error: "Tu rol puede consultar pero no agendar seguimientos." };

  const checked = checkFollowUpDay(input.day, now);
  if (!checked.ok) return { success: false, error: checked.error };
  const note = (input.note ?? "").trim();
  if (note.length > FOLLOW_UP_NOTE_MAX) return { success: false, error: `Escribilo en menos de ${FOLLOW_UP_NOTE_MAX} letras.` };

  const c = await caseForUser(user, input.caseId);
  if (!c) return { success: false, error: "No se encontró el expediente." };
  if (c.status === "CERRADO") return { success: false, error: "El expediente está cerrado. Reabrilo para agendar un seguimiento." };

  const dueDate = followUpDueDate(checked.day);
  const title = note || `Seguimiento: ${c.title}`;
  await prisma.$transaction([
    prisma.task.create({ data: { userId: user.id, title, caseId: c.id, dueDate, priority: "MEDIA" } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "SCHEDULE_FOLLOW_UP",
        entity: "Case",
        entityId: c.id,
        details: `Agendó un seguimiento para el ${fechaCorta(dueDate)}${note ? `: ${note}` : ""}`,
      },
    }),
  ]);
  return { success: true };
}

/** Seguimientos pendientes del expediente, de todos, el más próximo primero. */
export async function getCaseFollowUps(caseId: string, now = new Date()): Promise<CaseFollowUp[]> {
  const rows = await prisma.task.findMany({
    where: { caseId, status: { not: "COMPLETADA" } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, dueDate: true, userId: true, user: { select: { name: true, email: true } } },
  });
  const todayStart = new Date(endOfTodayInArgentina(now).getTime() - 24 * 60 * 60 * 1000);
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: (t.dueDate ?? now).toISOString(),
    userId: t.userId,
    userName: t.user?.name || t.user?.email || null,
    overdue: !!t.dueDate && t.dueDate < todayStart,
  }));
}

/** Marca como hecho un seguimiento propio. */
export async function completeFollowUp(user: FollowUpUser, taskId: string): Promise<Result & { caseId?: string | null }> {
  if (!user.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true, caseId: true } });
  if (!task || task.userId !== user.id) return { success: false, error: "Solo quien agendó el seguimiento lo puede marcar como hecho." };
  await prisma.task.update({ where: { id: taskId }, data: { status: "COMPLETADA" } });
  return { success: true, caseId: task.caseId };
}

/**
 * Manda a la campanita los seguimientos de hoy (o atrasados) que todavía no se avisaron.
 * Se llama cuando la campanita pide los avisos; cada seguimiento se avisa una sola vez.
 */
export async function notifyDueFollowUps(userId: string, now = new Date()): Promise<number> {
  const due = await prisma.task.findMany({
    where: {
      userId,
      caseId: { not: null },
      notifiedAt: null,
      status: { not: "COMPLETADA" },
      dueDate: { lt: endOfTodayInArgentina(now) },
    },
    select: { id: true, title: true, caseId: true, case: { select: { title: true } } },
    take: 20,
  });
  let sent = 0;
  for (const t of due) {
    // Si dos pedidos llegan juntos, solo uno marca la tarea y manda el aviso.
    const claimed = await prisma.task.updateMany({ where: { id: t.id, notifiedAt: null }, data: { notifiedAt: now } });
    if (claimed.count !== 1) continue;
    const caseTitle = t.case?.title || "el expediente";
    const message = t.title.startsWith("Seguimiento:") ? `Expediente: ${caseTitle}` : `${t.title} (${caseTitle})`;
    await createNotification(userId, "Hoy tenés un seguimiento", message, `/cases/${t.caseId}`);
    sent += 1;
  }
  return sent;
}
