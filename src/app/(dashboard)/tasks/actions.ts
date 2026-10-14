"use server";

import { createTask, toggleTask, deleteTask } from "@/services/system";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { actionErrorMessage } from "@/lib/action-error";

type TaskActionResult = { success: true } | { success: false; error: string };

const MANAGER_ROLES = ["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"];

export async function addTaskAction(
  title: string,
  description?: string,
  dueDate?: string | null,
  priority?: "BAJA" | "MEDIA" | "ALTA" | "URGENTE"
): Promise<TaskActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  if (!title || !title.trim()) {
    return { success: false, error: "No se pudo guardar la tarea: el título es obligatorio." };
  }

  try {
    const parsedDueDate = dueDate ? new Date(dueDate) : null;

    await createTask(
      session.user.id,
      title.trim(),
      description?.trim() || undefined,
      parsedDueDate,
      priority || "MEDIA"
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

  if (task.userId !== session.user.id && !MANAGER_ROLES.includes(session.user.role)) {
    return { error: `No se pudo ${verb} la tarea: no tenés permiso sobre tareas de otras personas.` };
  }

  return null;
}

export async function toggleTaskAction(id: string, currentStatus: string): Promise<TaskActionResult> {
  try {
    const denied = await findOwnTask(id, "actualizar");
    if (denied) return { success: false, error: denied.error };
    await toggleTask(id, currentStatus);
  } catch (error) {
    console.error("Error en toggleTaskAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar la tarea") };
  }

  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
  return { success: true };
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
