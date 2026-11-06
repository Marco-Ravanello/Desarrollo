/**
 * Tele de la Sala de Situación (idea 117): la parte de abajo va pasando sola entre
 * "Expedientes" y "Hoy en la Secretaría". Las cifras de arriba quedan siempre a la vista.
 * Reglas sin base de datos, para poder probarlas.
 */

export const TV_PANELS = [
  { id: "expedientes", label: "Expedientes" },
  { id: "hoy", label: "Hoy en la Secretaría" },
] as const;

export type TvPanelId = (typeof TV_PANELS)[number]["id"];

/** Segundos que queda cada pantalla antes de pasar a la siguiente. */
export const TV_ROTATE_SECONDS = 20;

/** La pantalla siguiente (o la anterior con step -1), dando la vuelta. */
export function nextPanelIndex(current: number, step: 1 | -1 = 1, total: number = TV_PANELS.length): number {
  if (total <= 0) return 0;
  return (((current + step) % total) + total) % total;
}

export type TodayItemKind = "vehiculo" | "recorrida" | "entrega" | "clase";

export type TodayItem = {
  id: string;
  kind: TodayItemKind;
  /** "09:00 a 13:00", "Todo el día"… */
  when: string;
  /** Minutos desde las 0 h, para ordenar (los de todo el día van primero). */
  sortMinutes: number;
  title: string;
  detail: string | null;
  pending: boolean;
};

export const TODAY_KIND_LABEL: Record<TodayItemKind, string> = {
  vehiculo: "Vehículo",
  recorrida: "Recorrida",
  entrega: "Entrega",
  clase: "Clase",
};

/** Lo de hoy ordenado: primero lo de todo el día, después por hora. Como mucho `max`. */
export function sortTodayItems(items: TodayItem[], max = 12): TodayItem[] {
  return [...items]
    .sort((a, b) => a.sortMinutes - b.sortMinutes || a.title.localeCompare(b.title, "es"))
    .slice(0, max);
}

/**
 * Horario de una reserva de vehículo visto desde hoy ("AAAA-MM-DD" de Argentina).
 * `startDay`/`endDay` son los días de Argentina de la salida y la vuelta, y `startTime`/`endTime`
 * las horas ("09:00"). Si empezó antes o termina después de hoy, se dice.
 */
export function reservationWhen(
  today: string,
  start: { day: string; time: string },
  end: { day: string; time: string }
): { when: string; sortMinutes: number } {
  const startsToday = start.day === today;
  const endsToday = end.day === today;
  const minutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  if (startsToday && endsToday) return { when: `${start.time} a ${end.time}`, sortMinutes: minutes(start.time) };
  if (startsToday) return { when: `Desde las ${start.time}`, sortMinutes: minutes(start.time) };
  if (endsToday) return { when: `Hasta las ${end.time}`, sortMinutes: 0 };
  return { when: "Todo el día", sortMinutes: -1 };
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** ¿El horario del curso ("Lunes y miércoles de 18 a 20") dice el día de la semana de hoy ("AAAA-MM-DD")? */
export function courseMeetsOn(horario: string | null | undefined, today: string): boolean {
  if (!horario) return false;
  const [y, m, d] = today.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const text = sinTildes(horario);
  if (/\b(todos los dias|de lunes a viernes|lunes a viernes)\b/.test(text)) return weekday !== "domingo" && (weekday !== "sabado" || text.includes("todos los dias"));
  return new RegExp(`\\b${weekday}`).test(text);
}

/** La hora de empezar que dice el horario ("de 18 a 20" o "18:30 hs"), en minutos; -1 si no dice. */
export function courseStartMinutes(horario: string | null | undefined): number {
  const match = sinTildes(horario || "").match(/(?:de|a las|desde las?)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:a|hs|h\b|-)/);
  if (!match) return -1;
  const h = Number(match[1]);
  if (h > 23) return -1;
  return h * 60 + Number(match[2] || 0);
}
