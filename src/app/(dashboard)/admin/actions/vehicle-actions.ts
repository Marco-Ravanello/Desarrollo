"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createVehicleReservationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const vehicleId = formData.get("vehicleId") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const reason = formData.get("reason") as string;

  try {
    // Validar superposición de reservas
    const overlapping = await prisma.vehicleReservation.findFirst({
      where: {
        vehicleId,
        status: { in: ['RESERVADO', 'EN_CURSO'] },
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } }
            ]
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } }
            ]
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } }
            ]
          }
        ]
      }
    });

    if (overlapping) {
      return { error: "El vehículo ya tiene una reserva en ese horario" };
    }

    const reservation = await prisma.vehicleReservation.create({
      data: {
        vehicleId,
        userId: session.user.id!,
        startDate,
        endDate,
        reason,
        status: 'RESERVADO'
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'VEHICLE_RESERVATION',
        entity: 'VehicleReservation',
        entityId: reservation.id,
        details: `Reserva de vehículo: ${vehicleId}`
      }
    });

    revalidatePath("/admin/vehicles");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al realizar la reserva" };
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

  const date = new Date(dateStr);
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) return { error: "Vehículo no encontrado" };

    // Validar cupo mensual
    if (vehicle.fuelMonthlyLimit && Number(vehicle.fuelMonthlyLimit) > 0) {
      const monthlySpent = await prisma.fuelRecord.aggregate({
        where: {
          vehicleId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        _sum: {
          amount: true
        }
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
        date: new Date(date),
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
        details: `Carga de combustible: ${liters}L - $${amount}`
      }
    });

    revalidatePath("/admin/vehicles");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al registrar la carga de combustible" };
  }
}
