import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { BLOCKING_STATUSES, formatReservationRange } from "@/lib/vehicle-reservations";

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
