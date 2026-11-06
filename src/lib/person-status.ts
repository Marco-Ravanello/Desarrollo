// Personas que fallecieron o se mudaron fuera del distrito. Sin base de datos, para poder probarlo solo.

import { canManageProgramEnrollment, MANAGEMENT_ROLES } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export const PERSON_STATUSES = {
  FALLECIDA: { label: "Falleció", banner: "Esta persona falleció", motivoBaja: "Falleció" },
  MUDADA: { label: "Se mudó fuera del distrito", banner: "Esta persona se mudó fuera del distrito", motivoBaja: "Se mudó fuera del distrito" },
} as const;

export type PersonStatus = keyof typeof PERSON_STATUSES;
export const isPersonStatus = (v: unknown): v is PersonStatus => v === "FALLECIDA" || v === "MUDADA";
export const PERSON_STATUS_NOTE_MAX = 300;

type Actor = { id?: string | null; role?: Role | string | null };

/** Lo marca quien carga datos sociales y da altas y bajas (no Auditoría ni el relevador). */
export const canMarkPersonStatus = (role?: Role | string | null) => canManageProgramEnrollment(role);

/** Lo deshace la conducción o quien lo marcó (por si fue un error). */
export function canUndoPersonStatus(user: Actor, markedBy: string | null | undefined): boolean {
  if (!canMarkPersonStatus(user.role)) return false;
  return MANAGEMENT_ROLES.includes(user.role as Role) || (Boolean(user.id) && user.id === markedBy);
}

/** "Falleció el 03/11/2026" o "Se mudó fuera del distrito" si no se sabe la fecha. */
export function personStatusText(estado: PersonStatus, fecha: string | null): string {
  const base = PERSON_STATUSES[estado].label;
  return fecha ? `${base} el ${fecha.split("-").reverse().join("/")}` : base;
}

/** El motivo de baja de cada programa: "Falleció" o "Se mudó fuera del distrito", con la nota si hay. */
export function withdrawReason(estado: PersonStatus, note: string | null): string {
  const base = PERSON_STATUSES[estado].motivoBaja;
  return note ? `${base}. ${note}` : base;
}
