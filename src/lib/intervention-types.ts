import type { InterventionType } from "@prisma/client";

// Tipos de intervención, en el orden en que se ofrecen al cargarla.
export const INTERVENTION_TYPES: { value: InterventionType; label: string }[] = [
  { value: "VISITA", label: "Visita domiciliaria" },
  { value: "ENTREVISTA", label: "Entrevista" },
  { value: "LLAMADA", label: "Llamada" },
  { value: "ENTREGA", label: "Entrega" },
  { value: "GESTION", label: "Gestión o trámite" },
  { value: "EMERGENCIA", label: "Emergencia climática" },
  { value: "OTRA", label: "Otra" },
];

export function interventionTypeLabel(type?: string | null): string | null {
  return INTERVENTION_TYPES.find((t) => t.value === type)?.label ?? null;
}

export function isInterventionType(value: unknown): value is InterventionType {
  return INTERVENTION_TYPES.some((t) => t.value === value);
}

/** Fecha del día en Buenos Aires (AAAA-MM-DD), para saber si algo se cargó "hoy". */
export function argentinaDay(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/** Quien cargó la intervención la puede corregir el mismo día. */
export function canEditIntervention(
  intervention: { userId: string; createdAt: Date | string },
  userId: string | null | undefined,
  now = new Date()
): boolean {
  return Boolean(userId) && intervention.userId === userId && argentinaDay(new Date(intervention.createdAt)) === argentinaDay(now);
}
