import prisma from "@/lib/prisma";
import {
  UNANSWERED_MAX_ROWS,
  cleanUnansweredQuestion,
  groupUnanswered,
  unansweredCutoff,
  unansweredKey,
  type UnansweredGroup,
  type UnansweredReason,
} from "@/lib/assistant-unanswered";

// Preguntas que el asistente no pudo responder. Se anotan solas al preguntar (api/assistant/stream) y las ve
// solo el Superadmin (admin/assistant/sin-respuesta). Se guarda la pregunta con los números largos tapados,
// el motivo, el rol y el área de quien preguntó; nunca la respuesta ni el nombre. A los 60 días se borran
// cuando alguien anota o abre la lista (no hace falta una tarea programada).

export async function deleteOldUnanswered(now = new Date()): Promise<number> {
  const res = await prisma.assistantUnansweredQuestion.deleteMany({ where: { createdAt: { lt: unansweredCutoff(now) } } });
  return res.count;
}

/** Anota una pregunta sin respuesta. No hace nada si la pregunta queda vacía. */
export async function recordUnanswered(
  input: { question: string; reason: UnansweredReason; role?: string | null; areaId?: string | null },
  now = new Date()
): Promise<boolean> {
  const question = cleanUnansweredQuestion(input.question);
  const key = unansweredKey(input.question);
  if (!question || !key) return false;
  await deleteOldUnanswered(now);
  // El nombre del área de ese momento, así se lee aunque después la persona cambie de área.
  const area = input.areaId ? await prisma.area.findUnique({ where: { id: input.areaId }, select: { name: true } }) : null;
  await prisma.assistantUnansweredQuestion.create({
    data: { question, key, reason: input.reason, role: input.role ?? null, areaName: area?.name ?? null, createdAt: now },
  });
  return true;
}

export type UnansweredView = "pendientes" | "resueltas";

/**
 * Las preguntas juntas por cómo se escribieron. Pendientes: las veces que se hizo sin que nadie la marcara.
 * Resueltas: las que se marcaron "Ya la entiende" (si se vuelve a preguntar y falla, aparece de nuevo en pendientes).
 */
export async function listUnanswered(view: UnansweredView, now = new Date()): Promise<{ groups: UnansweredGroup[]; pending: number; resolved: number }> {
  await deleteOldUnanswered(now);
  const rows = await prisma.assistantUnansweredQuestion.findMany({
    where: { createdAt: { gte: unansweredCutoff(now) } },
    select: { question: true, key: true, reason: true, role: true, areaName: true, createdAt: true, resolvedAt: true },
    orderBy: { createdAt: "desc" },
    take: UNANSWERED_MAX_ROWS,
  });
  const pendingGroups = groupUnanswered(rows.filter((r) => !r.resolvedAt));
  const pendingKeys = new Set(pendingGroups.map((g) => g.key));
  const resolvedGroups = groupUnanswered(rows.filter((r) => r.resolvedAt && !pendingKeys.has(r.key))).sort(
    (a, b) => (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0)
  );
  return { groups: view === "resueltas" ? resolvedGroups : pendingGroups, pending: pendingGroups.length, resolved: resolvedGroups.length };
}

/** Cuántas preguntas distintas esperan, para el botón de la página del asistente. */
export async function countPendingUnanswered(now = new Date()): Promise<number> {
  const rows = await prisma.assistantUnansweredQuestion.groupBy({
    by: ["key"],
    where: { resolvedAt: null, createdAt: { gte: unansweredCutoff(now) } },
  });
  return rows.length;
}

/** "Ya la entiende": marca todas las veces que se hizo esa pregunta. */
export async function resolveUnanswered(key: string, now = new Date()): Promise<number> {
  const res = await prisma.assistantUnansweredQuestion.updateMany({ where: { key, resolvedAt: null }, data: { resolvedAt: now } });
  return res.count;
}

/** "Volver a pendientes", por si se marcó por error. */
export async function reopenUnanswered(key: string): Promise<number> {
  const res = await prisma.assistantUnansweredQuestion.updateMany({ where: { key, resolvedAt: { not: null } }, data: { resolvedAt: null } });
  return res.count;
}

/** Borra todas las veces que se hizo esa pregunta. */
export async function deleteUnanswered(key: string): Promise<number> {
  const res = await prisma.assistantUnansweredQuestion.deleteMany({ where: { key } });
  return res.count;
}
