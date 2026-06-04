"use server";
import { createTask, toggleTask, deleteTask } from "@/services/system";
import { revalidatePath } from "next/cache";
export async function addTaskAction(userId: string, title: string) { await createTask(userId, title); revalidatePath("/tasks"); }
export async function toggleTaskAction(id: string, currentStatus: string) { await toggleTask(id, currentStatus); revalidatePath("/tasks"); }
export async function deleteTaskAction(id: string) { await deleteTask(id); revalidatePath("/tasks"); }
