"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createVehicleReservationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const vehicleId = formData.get("vehicleId") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const reason = formData.get("reason") as string;

  try {
    const reservation = await prisma.vehicleReservation.create({
      data: {
        vehicleId,
        userId: session.user.id!,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
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
  const date = formData.get("date") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const liters = parseFloat(formData.get("liters") as string);
  const ticketNumber = formData.get("ticketNumber") as string;

  try {
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
