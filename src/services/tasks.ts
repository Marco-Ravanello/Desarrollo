import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import {
  isTaskPriority, isTaskRepeat, nextOccurrence, parseViewerIds, serializeViewerIds, taskDueAt, TASK_MANAGER_ROLES, TASK_NOTES_MAX,
  TASK_TITLE_MAX,
} from "@/lib/tasks";

type Actor = { id?: string | null; role?: string | null };

export type TaskEdit = {
  title: string;
  description?: string | null;
  /** "AAAA-MM-DD", o vacío para dejarla sin fecha. */
  day?: string | null;
  /** "HH:MM" de Argentina; sin hora, las 9. */
  time?: string | null;
  priority: string;
  viewerIds: string[];
  /** "SEMANAL", "QUINCENAL", "MENSUAL", o vacío si no se repite. */
  repeat?: string | null;
};

/** Revisa cada cuánto se repite: hace falta una fecha. */
export function checkRepeat(repeat: string | null | undefined, hasDate: boolean): { ok: true; repeat: string | null } | { ok: false; error: string } {
  const value = (repeat ?? "").trim();
  if (!value) return { ok: true, repeat: null };
  if (!isTaskRepeat(value)) return { ok: false, error: "Elegí cada cuánto se repite." };
  if (!hasDate) return { ok: false, error: "Para que se repita, ponele una fecha." };
  return { ok: true, repeat: value };
}

/** Cambia título, notas, fecha, prioridad y con quién se comparte una tarea. */
export async function updateTask(user: Actor, id: string, input: TaskEdit) {
  if (!user.id) return { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  const task = await prisma.task.findUnique({ where: { id }, select: { userId: true, dueDate: true } });
  if (!task) return { success: false as const, error: "La tarea ya no existe. Recargá la página." };
  if (task.userId !== user.id && !TASK_MANAGER_ROLES.includes(user.role ?? "")) {
    return { success: false as const, error: "Solo quien creó la tarea puede cambiarla." };
  }

  const title = (input.title ?? "").trim();
  if (!title) return { success: false as const, error: "Escribí el título de la tarea." };
  if (title.length > TASK_TITLE_MAX) return { success: false as const, error: `El título puede tener hasta ${TASK_TITLE_MAX} letras.` };
  const description = (input.description ?? "").trim();
  if (description.length > TASK_NOTES_MAX) return { success: false as const, error: `Las notas pueden tener hasta ${TASK_NOTES_MAX} letras.` };
  if (!isTaskPriority(input.priority)) return { success: false as const, error: "Elegí la prioridad." };

  const day = (input.day ?? "").trim();
  const dueDate = day ? taskDueAt(day, input.time) : null;
  if (day && !dueDate) return { success: false as const, error: "Elegí una fecha válida." };
  const rep = checkRepeat(input.repeat, Boolean(dueDate));
  if (!rep.ok) return { success: false as const, error: rep.error };

  // Solo se comparte con usuarios que existen y están activos.
  const wanted = parseViewerIds((input.viewerIds ?? []).join(","));
  const valid = wanted.length
    ? (await prisma.user.findMany({ where: { id: { in: wanted }, isActive: true }, select: { id: true } })).map((u) => u.id)
    : [];
  const viewerIds = serializeViewerIds(wanted.filter((v) => valid.includes(v)), task.userId);

  const dateChanged = (task.dueDate?.getTime() ?? null) !== (dueDate?.getTime() ?? null);
  await prisma.task.update({
    where: { id },
    data: {
      title,
      description: description || null,
      dueDate,
      priority: input.priority,
      viewerIds,
      repeat: rep.repeat,
      // Con otra fecha, el aviso de la campanita vuelve a salir ese día.
      ...(dateChanged ? { notifiedAt: null } : {}),
    },
  });
  return { success: true as const };
}

/** Con quién se puede compartir una tarea: los usuarios activos, menos uno mismo. */
export async function getShareableUsers(exceptId: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: exceptId } },
    select: { id: true, name: true, username: true, area: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name || u.username || "Sin nombre", areaName: u.area?.name ?? null }));
}

type DoneResult = { success: true; next: Date | null } | { success: false; error: string };

/**
 * Marca la tarea como hecha (o la vuelve a dejar pendiente). Si se repite, al marcarla como hecha se crea
 * la próxima con lo mismo (notas, prioridad, con quién se comparte); una sola vez aunque se abra y cierre.
 */
export async function setTaskDone(user: Actor, id: string, done: boolean, now = new Date()): Promise<DoneResult> {
  if (!user.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id } });
    if (!task) return { success: false as const, error: "La tarea ya no existe. Recargá la página." };
    if (task.userId !== user.id && !TASK_MANAGER_ROLES.includes(user.role ?? "")) {
      return { success: false as const, error: "Solo quien creó la tarea puede marcarla." };
    }
    await tx.task.update({ where: { id }, data: { status: done ? "COMPLETADA" : "PENDIENTE" } });
    if (!done || !task.repeat || !isTaskRepeat(task.repeat) || !task.dueDate) return { success: true as const, next: null };

    const existing = task.nextTaskId ? await tx.task.findUnique({ where: { id: task.nextTaskId }, select: { dueDate: true } }) : null;
    if (existing) return { success: true as const, next: existing.dueDate };
    const next = await tx.task.create({
      data: {
        userId: task.userId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        viewerIds: task.viewerIds,
        caseId: task.caseId,
        repeat: task.repeat,
        dueDate: nextOccurrence(task.dueDate, task.repeat, todayInArgentina(now)),
        status: "PENDIENTE",
      },
    });
    await tx.task.update({ where: { id }, data: { nextTaskId: next.id } });
    return { success: true as const, next: next.dueDate };
  });
}

/** Las tareas que otras personas compartieron con esta (las ve, pero las maneja quien las creó). */
export async function getTasksSharedWith(userId: string) {
  const rows = await prisma.task.findMany({
    where: { viewerIds: { contains: userId }, userId: { not: userId } },
    include: { user: { select: { name: true, username: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  // "contains" busca el texto; acá se confirma que el id esté entero en la lista.
  return rows
    .filter((t) => parseViewerIds(t.viewerIds).includes(userId))
    .map((t) => ({
      id: t.id,
      userId: t.userId,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      status: t.status,
      priority: t.priority,
      viewerIds: t.viewerIds,
      repeat: t.repeat,
      createdAt: t.createdAt,
      // Del expediente solo se dice que hay uno: el título puede ser reservado.
      caseId: t.caseId,
      ownerName: t.user.name || t.user.username || "Otro usuario",
    }));
}
