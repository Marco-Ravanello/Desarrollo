"use server";

import { createHRRecord, markBackFromLeave } from "@/services/hr";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { HRStatus, HRRecord } from "@prisma/client";
import { ActionResult } from "@/types/actions";
import { actionErrorMessage } from "@/lib/action-error";

function buildTasksPayload(formData: FormData) {
  const tasksRaw = formData.get("tasks") as string || "";
  const healthNotes = formData.get("healthNotes") as string || "";
  const education = formData.get("education") as string || "";
  const drivingLicense = formData.get("drivingLicense") as string || "";

  if (healthNotes || education || drivingLicense) {
    return JSON.stringify({ tasksText: tasksRaw, healthNotes, education, drivingLicense });
  }
  return tasksRaw;
}

export async function createHRRecordAction(formData: FormData): Promise<ActionResult<HRRecord>> {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const tasksPayload = buildTasksPayload(formData);

  const data = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    dni: formData.get("dni") as string,
    fileNumber: formData.get("fileNumber") as string,
    startDate: formData.get("startDate") as string,
    position: formData.get("position") as string,
    status: formData.get("status") as string,
    statusUntil: formData.get("statusUntil") as string,
    areaId: formData.get("areaId") as string || undefined,
    contractType: formData.get("contractType") as string,
    category: parseInt(formData.get("category") as string) || null,
    salary: parseFloat(formData.get("salary") as string) || 0,
    schedule: formData.get("schedule") as string,
    imageUrl: formData.get("imageUrl") as string,
    tasks: tasksPayload,
  };

  try {
    const newRecord = await createHRRecord(data);
    revalidatePath("/admin/hr");
    return { success: true, data: newRecord };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo crear el legajo") };
  }
}

export async function updateHRRecordAction(id: string, formData: FormData): Promise<ActionResult<HRRecord>> {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const tasksPayload = buildTasksPayload(formData);

  const data = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    dni: formData.get("dni") as string,
    fileNumber: formData.get("fileNumber") as string,
    startDate: formData.get("startDate") as string ? new Date(formData.get("startDate") as string) : null,
    position: formData.get("position") as string,
    areaId: formData.get("areaId") as string || null,
    contractType: formData.get("contractType") as any,
    category: parseInt(formData.get("category") as string) || null,
    salary: parseFloat(formData.get("salary") as string) || 0,
    schedule: formData.get("schedule") as string,
    imageUrl: formData.get("imageUrl") as string,
    tasks: tasksPayload,
    status: formData.get("status") as any,
    statusUntil: formData.get("statusUntil") as string ? new Date(formData.get("statusUntil") as string) : null,
  };

  try {
    const updatedRecord = await prisma.hRRecord.update({ where: { id }, data });
    revalidatePath("/admin/hr");
    return { success: true, data: updatedRecord };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar el legajo") };
  }
}

export async function deleteHRRecordAction(id: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  try {
    await prisma.hRRecord.update({ where: { id }, data: { status: 'BAJA' as HRStatus } });
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo dar de baja el agente") };
  }
}

/** "Ya volvió", desde la tarjeta "De licencia hoy" del inicio. */
export async function markBackFromLeaveAction(id: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const result = await markBackFromLeave(session.user, id);
    if (!result.success) return result;
    revalidatePath("/dashboard");
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo marcar la vuelta") };
  }
}
