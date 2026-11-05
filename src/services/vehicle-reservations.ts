import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { BLOCKING_STATUSES, formatReservationRange } from "@/lib/vehicle-reservations";
import { FLEET_ADMIN_ROLES } from "@/lib/permissions";

// Controles de las reservas de vehículos que necesitan la base: choques de horario y turnos por vehículo.

/** Una reserva aprobada o en uso del mismo vehículo que se pisa con ese horario (sin contar `excludeId`). */
export async function findBlockingReservation(vehicleId: string, startDate: Date, endDate: Date, excludeId?: string, db: Prisma.TransactionClient = prisma) {
  return db.vehicleReservation.findFirst({
    where: {
      vehicleId,
      status: { in: BLOCKING_STATUSES },
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });
}

/** Espera a que termine cualquier otro cambio de reservas del mismo vehículo (dentro de una transacción). */
export async function lockVehicle(tx: Prisma.TransactionClient, vehicleId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"vehicle:" + vehicleId}))`;
}

export function conflictMessage(c: { startDate: Date; endDate: Date; status: string; user: { name: string | null } | null }) {
  return `El vehículo ya está ${c.status === "EN_CURSO" ? "en uso" : "reservado"} en ese horario: ${c.user?.name || "otra persona"}, ${formatReservationRange(c.startDate, c.endDate)}.`;
}

/**
 * Pedir un vehículo: las mismas reglas para la pantalla de reservas y para el asistente. El vehículo tiene que
 * estar disponible y sin otra reserva aprobada o en uso en ese horario. Queda pendiente, se registra en
 * Auditoría y se avisa a quienes administran la flota.
 */
export async function requestVehicleReservation(input: {
  vehicleId: string;
  user: { id: string; name?: string | null; areaId?: string | null };
  startDate: Date;
  endDate: Date;
  reason: string;
}): Promise<{ ok: true; id: string; vehicle: { plate: string; brand: string; model: string } } | { ok: false; error: string }> {
  const { vehicleId, user, startDate, endDate } = input;
  const reason = (input.reason ?? "").trim().slice(0, 300);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { ok: false, error: "Revisá la fecha y hora de salida y de devolución." };
  if (endDate <= startDate) return { ok: false, error: "La devolución tiene que ser después de la salida." };

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { ok: false, error: "No encontramos ese vehículo." };
  if (vehicle.status !== "DISPONIBLE") {
    return { ok: false, error: `El vehículo no se puede reservar: está ${vehicle.status === "EN_TALLER" ? "en el taller" : "fuera de servicio"}.` };
  }
  const overlapping = await findBlockingReservation(vehicleId, startDate, endDate);
  if (overlapping) return { ok: false, error: conflictMessage(overlapping) };

  const reservation = await prisma.vehicleReservation.create({
    data: { vehicleId, userId: user.id, areaId: user.areaId || null, startDate, endDate, reason, status: "PENDIENTE" },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "VEHICLE_RESERVATION_REQUEST",
      entity: "VehicleReservation",
      entityId: reservation.id,
      details: `Pedido de vehículo: ${vehicle.brand} ${vehicle.model} (${vehicle.plate}), ${formatReservationRange(startDate, endDate)}`,
    },
  });
  const admins = await prisma.user.findMany({ where: { role: { in: FLEET_ADMIN_ROLES }, NOT: { id: user.id } }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: "Nuevo pedido de vehículo",
        message: `${user.name || "Alguien"} pide el ${vehicle.plate} el ${formatReservationRange(startDate, endDate)}.`,
        link: "/admin/vehicles/requests",
      })),
    });
  }
  return { ok: true, id: reservation.id, vehicle: { plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model } };
}
