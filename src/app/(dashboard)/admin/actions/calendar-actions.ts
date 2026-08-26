"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const parseLocalDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  if (dateStr.includes("Z") || dateStr.includes("+") || (dateStr.includes("-") && dateStr.length > 19)) {
    return new Date(dateStr);
  }
  return new Date(`${dateStr}:00-03:00`);
};

export async function rescheduleTaskAction(id: string, dueDateStr: string, viewerIds?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return { success: false, error: "Tarea no encontrada" };
    if (task.userId !== session.user.id && session.user.role !== "SUPERADMIN") {
      return { success: false, error: "No autorizado para modificar esta tarea" };
    }

    const updateData: any = { dueDate: parseLocalDate(dueDateStr) };
    if (viewerIds !== undefined) updateData.viewerIds = viewerIds;

    await prisma.task.update({ where: { id }, data: updateData });

    revalidatePath("/admin/calendar");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al reprogramar la tarea" };
  }
}

export async function rescheduleReservationAction(id: string, startDateStr: string, endDateStr: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    const reservation = await prisma.vehicleReservation.findUnique({ where: { id } });
    if (!reservation) return { success: false, error: "Reserva no encontrada" };
    if (reservation.userId !== session.user.id && session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN_GENERAL") {
      return { success: false, error: "No autorizado para modificar esta reserva" };
    }

    await prisma.vehicleReservation.update({
      where: { id },
      data: {
        startDate: parseLocalDate(startDateStr)!,
        endDate: parseLocalDate(endDateStr)!
      }
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/vehicles/requests");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al reprogramar la reserva" };
  }
}

export async function reschedulePurchaseOrderAction(id: string, deliveryDateStr: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) return { success: false, error: "Orden de compra no encontrada" };

    await prisma.purchaseOrder.update({
      where: { id },
      data: { deliveryDate: parseLocalDate(deliveryDateStr) }
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/purchase-orders");
    revalidatePath(`/admin/purchase-orders/${id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al reprogramar la entrega de la orden" };
  }
}

export async function createSharedTaskAction(title: string, description: string, dueDateStr: string, viewerIds: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    await prisma.task.create({
      data: {
        title,
        description,
        userId: session.user.id,
        dueDate: parseLocalDate(dueDateStr),
        viewerIds: viewerIds || null,
        status: "PENDIENTE"
      }
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear la tarea" };
  }
}
