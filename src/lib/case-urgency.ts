import type { Prisma } from "@prisma/client";

// Qué cuenta como "expediente urgente", igual en todas las pantallas (Inicio, Expedientes,
// Sala de Situación, áreas, Carga del equipo, reportes y asistente): abierto o en proceso
// y con prioridad urgente. Los de prioridad alta no se suman, y los cerrados o derivados tampoco.

/** Estados que cuentan como "abiertos" (lo mismo que el filtro "Abiertos o en proceso" de Expedientes). */
export const ACTIVE_CASE_STATUSES = ["ABIERTO", "EN_PROCESO"] as const;

export const URGENT_PRIORITY = "URGENTE" as const;

/** Condición de Prisma para contar o buscar expedientes urgentes. */
export const URGENT_OPEN_CASE_WHERE = {
  priority: URGENT_PRIORITY,
  status: { in: [...ACTIVE_CASE_STATUSES] },
} satisfies Prisma.CaseWhereInput;

export function isActiveCase(c: { status: string }): boolean {
  return (ACTIVE_CASE_STATUSES as readonly string[]).includes(c.status);
}

export function isUrgentOpenCase(c: { status: string; priority: string }): boolean {
  return c.priority === URGENT_PRIORITY && isActiveCase(c);
}
