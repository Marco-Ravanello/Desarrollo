"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ReservationStatus, VehicleStatus } from "@prisma/client";

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  if (dateStr.includes("Z") || dateStr.includes("+") || (dateStr.includes("-") && dateStr.length > 19)) {
    return new Date(dateStr);
  }
  return new Date(`${dateStr}:00-03:00`);
};

export async function createVehicleReservationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const vehicleId = formData.get("vehicleId") as string;
  const startDate = parseLocalDate(formData.get("startDate") as string);
  const endDate = parseLocalDate(formData.get("endDate") as string);
  const reason = formData.get("reason") as string;
  const areaId = (session.user as any).areaId || null;

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return { error: "Vehículo no encontrado" };
    if (vehicle.status !== 'DISPONIBLE') {
      return { error: `El vehículo no está disponible para reserva (Estado: ${vehicle.status})` };
    }

    const overlapping = await prisma.vehicleReservation.findFirst({
      where: {
        vehicleId,
        status: { in: ['APROBADA', 'EN_CURSO'] },
        OR: [
          { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: startDate } }] },
          { AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }] },
          { AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }] }
        ]
      }
    });

    if (overlapping) {
      return { error: "El vehículo ya tiene una reserva confirmada en ese horario" };
    }

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
        details: `Solicitud de reserva: ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`
      }
    });

    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPERADMIN', 'ADMIN_GENERAL'] } }
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: "Nueva solicitud de vehículo",
          message: `${session.user.name} solicita el móvil ${vehicle.plate} para el ${startDate.toLocaleDateString()}`,
          link: "/admin/vehicles/requests"
        }
      });
    }

    revalidatePath("/admin/vehicles");
    revalidatePath("/admin/vehicles/requests");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al realizar la solicitud" };
  }
}

export async function updateReservationStatusAction(reservationId: string, newStatus: ReservationStatus, observations?: string) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  try {
    const reservation = await prisma.vehicleReservation.findUnique({
      where: { id: reservationId },
      include: { vehicle: true, user: true }
    });

    if (!reservation) return { error: "Reserva no encontrada" };

    const updated = await prisma.vehicleReservation.update({
      where: { id: reservationId },
      data: { status: newStatus, observations }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: `RESERVATION_${newStatus}`,
        entity: 'VehicleReservation',
        entityId: reservationId,
        details: `Reserva ${newStatus}: ${reservation.vehicle.plate} - Obs: ${observations || 'Ninguna'}`
      }
    });

    await prisma.notification.create({
      data: {
        userId: reservation.userId,
        title: `Tu reserva fue ${newStatus.toLowerCase()}`,
        message: `El móvil ${reservation.vehicle.plate} para el ${reservation.startDate.toLocaleDateString()} está ${newStatus.toLowerCase()}.`,
        link: "/admin/vehicles"
      }
    });

    revalidatePath("/admin/vehicles");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al actualizar la reserva" };
  }
}

export async function updateVehicleStatusAction(vehicleId: string, status: VehicleStatus) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No autorizado" };
  }

  try {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status }
    });

    revalidatePath("/admin/vehicles");
    return { success: true };
  } catch (error) {
    return { error: "Error al actualizar estado del vehículo" };
  }
}

export async function createFuelRecordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const vehicleId = formData.get("vehicleId") as string;
  const dateStr = formData.get("date") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const liters = parseFloat(formData.get("liters") as string);
  const ticketNumber = formData.get("ticketNumber") as string;

  const date = parseLocalDate(dateStr);
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

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
          error: `Cupo insuficiente. Saldo disponible: $${(Number(vehicle.fuelMonthlyLimit) - totalSpent).toLocaleString()}`
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
    return { error: "Error al registrar combustible" };
  }
}
