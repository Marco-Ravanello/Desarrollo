// Fechas de los seguimientos agendados. Se trabaja con el día de Argentina (sin hora):
// el seguimiento queda a las 9 de la mañana de ese día y el aviso sale desde las 0 h.

const TZ = "America/Argentina/Buenos_Aires";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const FOLLOW_UP_MAX_DAYS = 366;
export const FOLLOW_UP_NOTE_MAX = 300;

/** Hoy en Argentina, como "AAAA-MM-DD". */
export function todayInArgentina(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Las 9 de la mañana (Argentina) de ese día. */
export function followUpDueDate(isoDay: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** El primer instante de mañana en Argentina: lo que vence antes de esto es para hoy (o ya pasó). */
export function endOfTodayInArgentina(now = new Date()): Date {
  const [y, m, d] = todayInArgentina(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 3));
}

/** Revisa la fecha elegida: de hoy en adelante y hasta un año. */
export function checkFollowUpDay(isoDay: unknown, now = new Date()): { ok: true; day: string } | { ok: false; error: string } {
  if (typeof isoDay !== "string" || !ISO_DAY.test(isoDay) || followUpDueDate(isoDay).toISOString().slice(0, 10) !== isoDay) {
    return { ok: false, error: "Elegí una fecha válida." };
  }
  const today = todayInArgentina(now);
  if (isoDay < today) return { ok: false, error: "La fecha del seguimiento no puede ser anterior a hoy." };
  if (isoDay > addDays(today, FOLLOW_UP_MAX_DAYS)) return { ok: false, error: "Elegí una fecha dentro del próximo año." };
  return { ok: true, day: isoDay };
}
