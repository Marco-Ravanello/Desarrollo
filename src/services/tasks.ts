import prisma from "@/lib/prisma";
import {
  isTaskPriority, parseViewerIds, serializeViewerIds, taskDueAt, TASK_MANAGER_ROLES, TASK_NOTES_MAX, TASK_TITLE_MAX,
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
};

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
