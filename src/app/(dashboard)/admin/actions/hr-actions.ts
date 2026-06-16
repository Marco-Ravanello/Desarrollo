"use server";
import { createHRRecord } from "@/services/hr";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { HRStatus } from "@prisma/client";

export async function createHRRecordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No autorizado" };
  }

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
    salary: parseFloat(formData.get("salary") as string) || 0,
    tasks: formData.get("tasks") as string,
  };

  try {
    await createHRRecord(data);
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al crear el legajo" };
  }
}

export async function updateHRStatusAction(id: string, status: HRStatus, until?: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No autorizado" };
  }

  try {
    await prisma.hRRecord.update({
      where: { id },
      data: {
        status,
        statusUntil: until ? new Date(until) : null
      }
    });
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    return { error: "Error al actualizar el estado" };
  }
}

export async function updateHRRecordAction(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No autorizado" };
  }

  const data = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    dni: formData.get("dni") as string,
    fileNumber: formData.get("fileNumber") as string,
    startDate: formData.get("startDate") as string ? new Date(formData.get("startDate") as string) : null,
    position: formData.get("position") as string,
    areaId: formData.get("areaId") as string || null,
    contractType: formData.get("contractType") as any,
    salary: parseFloat(formData.get("salary") as string) || 0,
    tasks: formData.get("tasks") as string,
    status: formData.get("status") as any,
    statusUntil: formData.get("statusUntil") as string ? new Date(formData.get("statusUntil") as string) : null,
  };

  try {
    await prisma.hRRecord.update({
      where: { id },
      data
    });
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al actualizar el legajo" };
  }
}

export async function deleteHRRecordAction(id: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No autorizado" };
  }

  try {
    await prisma.hRRecord.update({
      where: { id },
      data: { status: 'BAJA' as HRStatus }
    });
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al dar de baja el agente" };
  }
}
