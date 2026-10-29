"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ReservationStatus, VehicleStatus } from "@prisma/client";
import { actionErrorMessage } from "@/lib/action-error";
import { FLEET_ADMIN_ROLES } from "@/lib/permissions";
import { RESERVATION_STATUS, canChangeReservation, formatReservationRange, reservationStatusLabel } from "@/lib/vehicle-reservations";
import { conflictMessage, findBlockingReservation, lockVehicle } from "@/services/vehicle-reservations";
import { formatPesos } from "@/lib/formato";

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  // Un día suelto (la fecha de una carga de combustible): mediodía en Argentina.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(`${dateStr}T12:00:00-03:00`);
  if (dateStr.includes("Z") || dateStr.includes("+") || (dateStr.includes("-") && dateStr.length > 19)) {
    return new Date(dateStr);
  }
  return new Date(`${dateStr}:00-03:00`);
};

export async function createVehicleReservationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  const vehicleId = formData.get("vehicleId") as string;
  const startDate = parseLocalDate(formData.get("startDate") as string);
  const endDate = parseLocalDate(formData.get("endDate") as string);
  const reason = formData.get("reason") as string;
  const areaId = (session.user as any).areaId || null;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { error: "Revisá la fecha y hora de salida y de devolución." };
  if (endDate <= startDate) return { error: "La devolución tiene que ser después de la salida." };

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return { error: "No encontramos ese vehículo." };
    if (vehicle.status !== 'DISPONIBLE') {
      return { error: `El vehículo no se puede reservar: está ${vehicle.status === "EN_TALLER" ? "en el taller" : "fuera de servicio"}.` };
    }

    const overlapping = await findBlockingReservation(vehicleId, startDate, endDate);
    if (overlapping) return { error: conflictMessage(overlapping) };

    const reservation = await prisma.vehicleReservation.create({
      data: {
        vehicleId,
        userId: session.user.id!,
        areaId,
        startDate,
        endDate,
        reason,
        status: 'PENDIENTE'
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'VEHICLE_RESERVATION_REQUEST',
        entity: 'VehicleReservation',
        entityId: reservation.id,
        details: `Pedido de vehículo: ${vehicle.brand} ${vehicle.model} (${vehicle.plate}), ${formatReservationRange(startDate, endDate)}`
      }
    });

    const admins = await prisma.user.findMany({
      where: { role: { in: FLEET_ADMIN_ROLES }, NOT: { id: session.user.id! } },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title: "Nuevo pedido de vehículo",
          message: `${session.user.name} pide el ${vehicle.plate} el ${formatReservationRange(startDate, endDate)}.`,
          link: "/admin/vehicles/requests"
        }))
      });
    }

    revalidatePath("/admin/vehicles");
    revalidatePath("/admin/vehicles/requests");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: actionErrorMessage(error, "No se pudo realizar la solicitud") };
  }
}

const KM_MAX = 2_000_000;

/**
 * Aprobar, rechazar, cancelar, salida ("Salió") y vuelta ("Volvió") de una reserva.
 * `km` es opcional: el kilometraje al salir o al volver, que queda en las observaciones.
 */
export async function updateReservationStatusAction(reservationId: string, newStatus: ReservationStatus, observations?: string, km?: number | null) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  if (!(newStatus in RESERVATION_STATUS)) return { error: "Ese estado no existe." };
  if (km != null && (!Number.isInteger(km) || km < 0 || km > KM_MAX)) return { error: "Revisá el kilometraje: tiene que ser un número entero." };

  try {
    const reservation = await prisma.vehicleReservation.findUnique({
      where: { id: reservationId },
      include: { vehicle: true, user: true }
    });

    if (!reservation) return { error: "No encontramos esa reserva." };
    if (!canChangeReservation({ id: session.user.id, role: session.user.role }, reservation, newStatus)) {
      return {
        error: `No se puede pasar la reserva de "${reservationStatusLabel(reservation.status)}" a "${reservationStatusLabel(newStatus)}" con tu rol.`
      };
    }

    const notes = [
      reservation.observations,
      observations?.trim() ? observations.trim().slice(0, 300) : null,
      km != null ? `${newStatus === "EN_CURSO" ? "Salió" : "Volvió"} con ${km.toLocaleString("es-AR")} km.` : null,
    ].filter(Boolean).join("\n");

    // De a una por vehículo, para que dos aprobaciones al mismo tiempo no dejen dos reservas encimadas.
    const outcome = await prisma.$transaction(async (tx) => {
      await lockVehicle(tx, reservation.vehicleId);
      if (newStatus === "APROBADA") {
        const conflict = await findBlockingReservation(reservation.vehicleId, reservation.startDate, reservation.endDate, reservation.id, tx);
        if (conflict) return `No se puede aprobar. ${conflictMessage(conflict)}`;
      }
      // Solo si nadie la cambió mientras tanto.
      const { count } = await tx.vehicleReservation.updateMany({
        where: { id: reservationId, status: reservation.status },
        data: { status: newStatus, observations: notes || null }
      });
      return count === 0 ? "Otra persona cambió esta reserva recién. Recargá la página para ver cómo quedó." : null;
    });
    if (outcome) return { error: outcome };

    const range = formatReservationRange(reservation.startDate, reservation.endDate);
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `RESERVATION_${newStatus}`,
        entity: 'VehicleReservation',
        entityId: reservationId,
        details: `Reserva ${reservationStatusLabel(newStatus).toLowerCase()}: ${reservation.vehicle.plate}, ${range}${observations?.trim() ? `. Obs.: ${observations.trim()}` : ""}${km != null ? `. ${km} km` : ""}`
      }
    });

    // Avisos: a quien la pidió cuando decide otra persona; a la flota cuando cancela quien la pidió.
    if (reservation.userId !== session.user.id && ["APROBADA", "RECHAZADA", "CANCELADA"].includes(newStatus)) {
      await prisma.notification.create({
        data: {
          userId: reservation.userId,
          title: `Tu reserva del ${reservation.vehicle.plate} fue ${reservationStatusLabel(newStatus).toLowerCase()}`,
          message: `${reservation.vehicle.brand} ${reservation.vehicle.model}, ${range}.${observations?.trim() ? ` ${observations.trim()}` : ""}`,
          link: "/admin/vehicles"
        }
      });
    } else if (newStatus === "CANCELADA" && reservation.status === "APROBADA") {
      const admins = await prisma.user.findMany({ where: { role: { in: FLEET_ADMIN_ROLES }, NOT: { id: session.user.id } }, select: { id: true } });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            title: "Se canceló una reserva de vehículo",
            message: `${session.user.name} canceló el ${reservation.vehicle.plate}, ${range}. El vehículo queda libre.`,
            link: "/admin/vehicles/requests"
          }))
        });
      }
    }

    revalidatePath("/admin/vehicles");
    revalidatePath("/admin/vehicles/requests");
    revalidatePath(`/admin/vehicles/${reservation.vehicleId}`);
    revalidatePath("/admin/calendar");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: actionErrorMessage(error, "No se pudo actualizar la reserva") };
  }
}

export async function updateVehicleStatusAction(vehicleId: string, status: VehicleStatus) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  try {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status }
    });

    revalidatePath("/admin/vehicles");
    return { success: true };
  } catch (error) {
    return { error: actionErrorMessage(error, "No se pudo actualizar estado del vehículo") };
  }
}

export async function createFuelRecordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  const vehicleId = formData.get("vehicleId") as string;
  const dateStr = formData.get("date") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const liters = parseFloat(formData.get("liters") as string);
  const ticketNumber = formData.get("ticketNumber") as string;

  const date = parseLocalDate(dateStr);
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) return { error: "Vehículo no encontrado" };

    if (vehicle.fuelMonthlyLimit && Number(vehicle.fuelMonthlyLimit) > 0) {
      const monthlySpent = await prisma.fuelRecord.aggregate({
        where: {
          vehicleId,
          date: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: { amount: true }
      });

      const totalSpent = Number(monthlySpent._sum.amount || 0);
      if (totalSpent + amount > Number(vehicle.fuelMonthlyLimit)) {
        return {
          error: `Cupo insuficiente. Saldo disponible: ${formatPesos(Number(vehicle.fuelMonthlyLimit) - totalSpent)}`
        };
      }
    }

    const record = await prisma.fuelRecord.create({
      data: {
        vehicleId,
        date,
        amount,
        liters,
        ticketNumber,
        userId: session.user.id!
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'FUEL_RECORD',
        entity: 'FuelRecord',
        entityId: record.id,
        details: `Carga combustible: ${vehicle.plate} - ${liters}L`
      }
    });

    revalidatePath("/admin/vehicles");
    return { success: true };
  } catch (error) {
    return { error: actionErrorMessage(error, "No se pudo registrar combustible") };
  }
}
