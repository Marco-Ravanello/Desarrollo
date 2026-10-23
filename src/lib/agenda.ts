// Cuentas de la Agenda que no dependen de la pantalla: semanas de lunes a domingo, días que son solo fecha
// y el nombre corto de cada evento. Sin base de datos, para poder probarlo solo.

/** Encabezados de la semana, de lunes a domingo. */
export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAY_LETTER = ["L", "M", "M", "J", "V", "S", "D"];

/** Cuántos días de la semana pasaron desde el lunes (lunes 0, domingo 6). */
export function weekdayFromMonday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** El lunes de la semana de esa fecha, a la medianoche. */
export function startOfWeekMonday(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekdayFromMonday(d));
}

/**
 * Las casillas de un mes, de lunes a domingo: null para los huecos antes del 1 y después del último día,
 * así la grilla siempre tiene semanas completas.
 */
export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: weekdayFromMonday(first) }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Las fechas que se eligen en un calendario sin hora (la entrega de una orden de compra) se guardan a la
 * medianoche UTC. Leídas en hora argentina caerían a las 21 del día anterior: se toman como el día entero.
 */
export function isDateOnly(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** Ese día guardado a la medianoche UTC, como medianoche local (el mismo día del calendario). */
export function dateOnlyToLocal(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** "AAAA-MM-DD" del día local de la fecha (para los campos de fecha). */
export function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "HH:MM" local de la fecha (para los campos de hora). */
export function localTimeKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type AgendaEventType = "reservation" | "order" | "task";

/** Nombre corto para que entre en la casilla de un día: la patente, la orden o el título de la tarea. */
export function shortEventLabel(type: AgendaEventType, raw: any): string {
  if (type === "reservation") return raw?.vehicle?.plate || "Vehículo";
  if (type === "order") return raw?.number ? `Entrega OC ${raw.number}` : "Entrega de orden";
  return raw?.title?.trim() || "Tarea sin título";
}

/** Los primeros que entran en la casilla y cuántos quedan afuera ("+2 más"). */
export function chipsThatFit<T>(events: T[], max = 3): { shown: T[]; more: number } {
  if (events.length <= max) return { shown: events, more: 0 };
  // Si no entran todos, se deja un lugar para el "+N más".
  return { shown: events.slice(0, max - 1), more: events.length - (max - 1) };
}

/** Una tarea se ve en la Agenda de quien la creó y de quienes están en su lista para compartir. */
export function isTaskVisibleTo(task: { userId: string; viewerIds?: string | null }, userId: string): boolean {
  if (task.userId === userId) return true;
  return (task.viewerIds ?? "").split(",").map((s) => s.trim()).includes(userId);
}

/** El horario de trabajo que se muestra en las vistas Semana y Día si no hay nada antes ni después. */
export const WORK_HOURS: [number, number] = [8, 18];

/**
 * Qué horas mostrar en la grilla de esos días: el horario de trabajo, estirado para que entre
 * lo que empieza antes o termina después. Devuelve [primera hora, hora en que termina la grilla].
 */
export function visibleHourRange(
  events: { startDate: Date; endDate: Date; allDay?: boolean }[],
  days: Date[],
  base: [number, number] = WORK_HOURS
): [number, number] {
  let [from, to] = base;
  for (const day of days) {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
    for (const e of events) {
      if (e.allDay || e.startDate >= dayEnd || (e.endDate <= dayStart && e.startDate < dayStart)) continue;
      const start = e.startDate < dayStart ? 0 : e.startDate.getHours();
      const end = e.endDate >= dayEnd ? 24 : Math.max(e.endDate.getHours() + (e.endDate.getMinutes() > 0 ? 1 : 0), start + 1);
      from = Math.min(from, start);
      to = Math.max(to, end);
    }
  }
  return [from, to];
}
