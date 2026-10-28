"use server";

import { createTask, deleteTask } from "@/services/system";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { actionErrorMessage } from "@/lib/action-error";
import { followUpDueDate } from "@/lib/follow-up-dates";
import { checkRepeat, setTaskDone, updateTask, type TaskEdit } from "@/services/tasks";
import { TASK_MANAGER_ROLES } from "@/lib/tasks";

type TaskActionResult = { success: true } | { success: false; error: string };
/** Al marcar como hecha una tarea que se repite: cuándo quedó la próxima (ISO). */
type ToggleResult = { success: true; next: string | null } | { success: false; error: string };

export async function addTaskAction(
  title: string,
  description?: string,
  dueDate?: string | null,
  priority?: "BAJA" | "MEDIA" | "ALTA" | "URGENTE",
  repeat?: string | null
): Promise<TaskActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  if (!title || !title.trim()) {
    return { success: false, error: "No se pudo guardar la tarea: el título es obligatorio." };
  }
  const rep = checkRepeat(repeat, Boolean(dueDate));
  if (!rep.ok) return { success: false, error: rep.error };

  try {
    // Un día suelto ("AAAA-MM-DD") queda a las 9 de la mañana de Argentina, como los seguimientos.
    const parsedDueDate = dueDate ? (/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? followUpDueDate(dueDate) : new Date(dueDate)) : null;

    await createTask(
      session.user.id,
      title.trim(),
      description?.trim() || undefined,
      parsedDueDate,
      priority || "MEDIA",
      rep.repeat
    );
  } catch (error) {
    console.error("Error en addTaskAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar la tarea") };
  }

  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
  return { success: true };
}

async function findOwnTask(id: string, verb: string): Promise<{ error: string } | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return { error: `No se pudo ${verb} la tarea: ya no existe. Recargá la página.` };
  }

  if (task.userId !== session.user.id && !TASK_MANAGER_ROLES.includes(session.user.role)) {
    return { error: `No se pudo ${verb} la tarea: no tenés permiso sobre tareas de otras personas.` };
  }

  return null;
}

/** Marca la tarea como hecha o la vuelve a dejar pendiente (si se repite, crea la próxima). */
export async function toggleTaskAction(id: string, currentStatus: string): Promise<ToggleResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  let next: Date | null = null;
  try {
    const res = await setTaskDone(session.user, id, currentStatus !== "COMPLETADA");
    if (!res.success) return res;
    next = res.next;
  } catch (error) {
    console.error("Error en toggleTaskAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar la tarea") };
  }

  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
  revalidatePath("/dashboard");
  return { success: true, next: next ? next.toISOString() : null };
}

export async function deleteTaskAction(id: string): Promise<TaskActionResult> {
  try {
    const denied = await findOwnTask(id, "eliminar");
    if (denied) return { success: false, error: denied.error };
    await deleteTask(id);
  } catch (error) {
    console.error("Error en deleteTaskAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo eliminar la tarea") };
  }

  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
  return { success: true };
}

/** Guarda los cambios de una tarea (título, notas, fecha, prioridad y con quién se comparte). */
export async function updateTaskAction(id: string, input: TaskEdit): Promise<TaskActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const result = await updateTask(session.user, id, input);
    if (!result.success) return result;
  } catch (error) {
    console.error("Error en updateTaskAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar la tarea") };
  }
  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}
