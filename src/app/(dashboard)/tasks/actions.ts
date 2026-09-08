"use server";

import { createTask, toggleTask, deleteTask } from "@/services/system";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function addTaskAction(
  title: string,
  description?: string,
  dueDate?: string | null,
  priority?: "BAJA" | "MEDIA" | "ALTA" | "URGENTE"
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No autorizado");
  }

  if (!title || !title.trim()) {
    throw new Error("El título es obligatorio");
  }

  const parsedDueDate = dueDate ? new Date(dueDate) : null;

  await createTask(
    session.user.id,
    title.trim(),
    description?.trim() || undefined,
    parsedDueDate,
    priority || "MEDIA"
  );

  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
}

export async function toggleTaskAction(id: string, currentStatus: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No autorizado");
  }

  const task = await prisma.task.findUnique({
    where: { id }
  });

  if (!task) {
    throw new Error("Tarea no encontrada");
  }

  if (task.userId !== session.user.id && session.user.role !== "SUPERADMIN") {
    throw new Error("Sin permisos para modificar esta tarea");
  }

  await toggleTask(id, currentStatus);
  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
}

export async function deleteTaskAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No autorizado");
  }

  const task = await prisma.task.findUnique({
    where: { id }
  });

  if (!task) {
    throw new Error("Tarea no encontrada");
  }

  if (task.userId !== session.user.id && session.user.role !== "SUPERADMIN") {
    throw new Error("Sin permisos para eliminar esta tarea");
  }

  await deleteTask(id);
  revalidatePath("/tasks");
  revalidatePath("/admin/calendar");
}
