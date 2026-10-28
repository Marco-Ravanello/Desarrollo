"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { FLEET_ADMIN_ROLES, PURCHASING_EDIT_ROLES } from "@/lib/permissions";
import { formatReservationRange, isFleetAdmin, reservationStatusLabel } from "@/lib/vehicle-reservations";
import { conflictMessage, findBlockingReservation, lockVehicle } from "@/services/vehicle-reservations";
import { checkRepeat } from "@/services/tasks";

const parseLocalDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  if (dateStr.includes("Z") || dateStr.includes("+") || (dateStr.includes("-") && dateStr.length > 19)) {
    return new Date(dateStr);
  }
  return new Date(`${dateStr}:00-03:00`);
};

export async function rescheduleTaskAction(id: string, dueDateStr: string, viewerIds?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

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
    return { success: false, error: actionErrorMessage(error, "No se pudo reprogramar la tarea") };
  }
}

/**
 * Mover una reserva en la Agenda. Se controla que el vehículo esté libre en el horario nuevo.
 * Si quien la pidió mueve una reserva ya aprobada, vuelve a quedar pendiente de aprobación.
 */
export async function rescheduleReservationAction(id: string, startDateStr: string, endDateStr: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  const userId = session.user.id;

  const startDate = parseLocalDate(startDateStr);
  const endDate = parseLocalDate(endDateStr);
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "No se entendió el horario nuevo. Probá de nuevo." };
  }
  if (endDate <= startDate) return { success: false, error: "La devolución tiene que ser después de la salida." };

  try {
    const reservation = await prisma.vehicleReservation.findUnique({ where: { id }, include: { vehicle: true } });
    if (!reservation) return { success: false, error: "No encontramos esa reserva." };
    const admin = isFleetAdmin(session.user.role);
    if (reservation.userId !== userId && !admin) {
      return { success: false, error: "Solo quien pidió la reserva, o quien administra la flota, la puede mover." };
    }
    if (reservation.status !== "PENDIENTE" && reservation.status !== "APROBADA") {
      return { success: false, error: `Esta reserva está ${reservationStatusLabel(reservation.status).toLowerCase()} y ya no se puede mover.` };
    }

    const backToPending = reservation.status === "APROBADA" && !admin;
    const error = await prisma.$transaction(async (tx) => {
      await lockVehicle(tx, reservation.vehicleId);
      const conflict = await findBlockingReservation(reservation.vehicleId, startDate, endDate, reservation.id, tx);
      if (conflict) return conflictMessage(conflict);
      const { count } = await tx.vehicleReservation.updateMany({
        where: { id, status: reservation.status },
        data: { startDate, endDate, ...(backToPending ? { status: "PENDIENTE" as const } : {}) },
      });
      return count === 0 ? "Otra persona cambió esta reserva recién. Recargá la página para ver cómo quedó." : null;
    });
    if (error) return { success: false, error };

    const range = formatReservationRange(startDate, endDate);
    await prisma.auditLog.create({
      data: {
        userId,
        action: "RESERVATION_RESCHEDULE",
        entity: "VehicleReservation",
        entityId: id,
        details: `Reserva movida: ${reservation.vehicle.plate}, de ${formatReservationRange(reservation.startDate, reservation.endDate)} a ${range}${backToPending ? ". Vuelve a pendiente de aprobación" : ""}`,
      },
    });
    if (backToPending) {
      const admins = await prisma.user.findMany({ where: { role: { in: FLEET_ADMIN_ROLES }, NOT: { id: userId } }, select: { id: true } });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            title: "Una reserva aprobada cambió de horario",
            message: `${session.user.name} movió el ${reservation.vehicle.plate} al ${range}. Hay que aprobarla de nuevo.`,
            link: "/admin/vehicles/requests",
          })),
        });
      }
    }

    revalidatePath("/admin/calendar");
    revalidatePath("/admin/vehicles");
    revalidatePath("/admin/vehicles/requests");
    return { success: true, backToPending };
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo reprogramar la reserva") };
  }
}

export async function reschedulePurchaseOrderAction(id: string, deliveryDateStr: string) {
  const session = await auth();
  if (session?.user && !PURCHASING_EDIT_ROLES.includes(session.user.role)) {
    return { success: false, error: "No se pudo reprogramar: tu rol no puede modificar órdenes de compra." };
  }
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

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
    return { success: false, error: actionErrorMessage(error, "No se pudo reprogramar la entrega de la orden") };
  }
}

export async function createSharedTaskAction(title: string, description: string, dueDateStr: string, viewerIds: string, repeat?: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  const rep = checkRepeat(repeat, Boolean(dueDateStr));
  if (!rep.ok) return { success: false, error: rep.error };

  try {
    await prisma.task.create({
      data: {
        title,
        description,
        userId: session.user.id,
        dueDate: parseLocalDate(dueDateStr),
        viewerIds: viewerIds || null,
        repeat: rep.repeat,
        status: "PENDIENTE"
      }
    });

    revalidatePath("/admin/calendar");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo crear la tarea") };
  }
}
