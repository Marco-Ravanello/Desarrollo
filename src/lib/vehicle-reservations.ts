import type { ReservationStatus, Role } from "@prisma/client";
import { FLEET_ADMIN_ROLES } from "@/lib/permissions";
import { formatFecha, formatFechaHora, formatHora } from "@/lib/fechas";

// Reservas de vehículos: nombres de los estados, fechas en hora argentina y quién puede hacer qué.

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; className: string }> = {
  PENDIENTE: { label: "Pendiente", className: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30" },
  APROBADA: { label: "Aprobada", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  RECHAZADA: { label: "Rechazada", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30" },
  EN_CURSO: { label: "En uso", className: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  FINALIZADA: { label: "Finalizada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  CANCELADA: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border/60" },
};

export function reservationStatusLabel(status: string): string {
  return RESERVATION_STATUS[status as ReservationStatus]?.label ?? status;
}

/** Las reservas que ocupan el vehículo: no se puede aprobar ni mover otra encima. */
export const BLOCKING_STATUSES: ReservationStatus[] = ["APROBADA", "EN_CURSO"];

/** Dos horarios se pisan si uno empieza antes de que termine el otro (10 a 12 y 12 a 14 no se pisan). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// formatFechaHora vive en lib/fechas; se sigue exportando desde acá porque lo usan las pantallas de vehículos.
export { formatFechaHora };

/** "27/10/2026 de 10:00 a 12:00", o con las dos fechas si termina otro día. Siempre en hora argentina. */
export function formatReservationRange(start: Date | string, end: Date | string): string {
  if (formatFecha(start) === formatFecha(end)) return `${formatFecha(start)} de ${formatHora(start)} a ${formatHora(end)}`;
  return `${formatFechaHora(start)} al ${formatFechaHora(end)}`;
}

export function isFleetAdmin(role?: Role | string | null): boolean {
  return FLEET_ADMIN_ROLES.includes(role as Role);
}

/**
 * ¿Puede pasar la reserva a ese estado?
 * Aprobar, rechazar, salida y vuelta: quien administra la flota. Cancelar: también quien la pidió.
 */
export function canChangeReservation(
  user: { id: string; role?: Role | string | null },
  reservation: { userId: string; status: ReservationStatus },
  to: ReservationStatus
): boolean {
  const admin = isFleetAdmin(user.role);
  const owner = reservation.userId === user.id;
  switch (`${reservation.status}>${to}`) {
    case "PENDIENTE>APROBADA":
    case "PENDIENTE>RECHAZADA":
    case "APROBADA>EN_CURSO":
    case "EN_CURSO>FINALIZADA":
      return admin;
    case "PENDIENTE>CANCELADA":
    case "APROBADA>CANCELADA":
      return admin || owner;
    default:
      return false;
  }
}

const ACTION_ORDER: ReservationStatus[] = ["APROBADA", "EN_CURSO", "FINALIZADA", "RECHAZADA", "CANCELADA"];

/** Los botones que ve esta persona en esta reserva. */
export function reservationActionsFor(
  user: { id: string; role?: Role | string | null },
  reservation: { userId: string; status: ReservationStatus }
) {
  return ACTION_ORDER.filter((to) => canChangeReservation(user, reservation, to)) as ("APROBADA" | "RECHAZADA" | "CANCELADA" | "EN_CURSO" | "FINALIZADA")[];
}
