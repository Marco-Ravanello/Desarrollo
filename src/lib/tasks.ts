// Tareas: prioridades, con quién se comparten y fecha con hora de Argentina. Sin acceso a la base:
// se usa en pantalla y en el servidor.

export const TASK_PRIORITIES = [
  { value: "URGENTE", label: "Urgente" },
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Normal" },
  { value: "BAJA", label: "Baja" },
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number]["value"];

export const TASK_TITLE_MAX = 200;
export const TASK_NOTES_MAX = 1000;
/** Hora que se usa cuando la tarea tiene día pero no hora (la misma que los seguimientos). */
export const TASK_DEFAULT_TIME = "09:00";

export function isTaskPriority(value: unknown): value is TaskPriority {
  return TASK_PRIORITIES.some((p) => p.value === value);
}

/** Los usuarios con quienes se comparte, guardados como "id1,id2". */
export function parseViewerIds(value: string | null | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
}

/** Para guardar: sin repetir, sin la persona dueña de la tarea; null si no se comparte con nadie. */
export function serializeViewerIds(ids: string[], ownerId: string): string | null {
  const clean = [...new Set(ids.map((s) => s.trim()).filter((s) => s && s !== ownerId))];
  return clean.length ? clean.join(",") : null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Día y hora de Argentina (UTC−3, sin horario de verano) → instante. Null si el día no es válido. */
export function taskDueAt(day: string, time?: string | null): Date | null {
  if (!ISO_DAY.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  // "2026-02-30" no existe: Date lo pasaría al 2 de marzo.
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== day) return null;
  const hhmm = time && TIME.test(time) ? time : TASK_DEFAULT_TIME;
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + 3, mm));
}

/** El día ("AAAA-MM-DD") y la hora ("HH:MM") de Argentina de una fecha guardada, para el formulario. */
export function taskDueParts(value: string | Date | null | undefined): { day: string; time: string } {
  if (!value) return { day: "", time: TASK_DEFAULT_TIME };
  const ar = new Date(new Date(value).getTime() - 3 * 3600000);
  if (Number.isNaN(ar.getTime())) return { day: "", time: TASK_DEFAULT_TIME };
  return { day: ar.toISOString().slice(0, 10), time: ar.toISOString().slice(11, 16) };
}
