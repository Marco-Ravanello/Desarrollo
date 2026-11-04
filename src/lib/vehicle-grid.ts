// Cuentas de la grilla de reservas de vehículos: los bloques ocupados de cada día, los tramos de media hora
// que se eligen y si un horario está libre. Sin base de datos, para poder probarlo solo.
// Todo en la hora del navegador, igual que la Agenda (el servidor toma lo que se manda como hora argentina).

/** Las reservas que ocupan el vehículo en la grilla: las que todavía pueden salir. */
export const BUSY_STATUSES = ["PENDIENTE", "APROBADA", "EN_CURSO"] as const;

export const SLOT_MINUTES = 30;
/** Horas que se ven siempre: de 7 a 21. Si hay una reserva más temprano o más tarde, la grilla se estira. */
export const GRID_HOURS: [number, number] = [7, 21];

export type BusyReservation = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  user?: { name?: string | null } | null;
};

export type DayBlock = {
  id: string;
  status: string;
  who: string;
  start: Date;
  end: Date;
  /** Desde el principio de la grilla, en fracción de la altura (0 a 1). */
  top: number;
  height: number;
  /** Empezó el día anterior o sigue al día siguiente. */
  fromBefore: boolean;
  toAfter: boolean;
};

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

export function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function isBusy(r: { status: string }): boolean {
  return (BUSY_STATUSES as readonly string[]).includes(r.status);
}

/** Las horas que muestra la grilla para esos días: 7 a 21, o más si alguna reserva se sale de ahí. */
export function gridHoursFor(reservations: BusyReservation[], days: Date[], base: [number, number] = GRID_HOURS): [number, number] {
  let [from, to] = base;
  for (const day of days) {
    const s = dayStart(day);
    const e = addDays(s, 1);
    for (const r of reservations) {
      if (!isBusy(r)) continue;
      const rs = toDate(r.startDate);
      const re = toDate(r.endDate);
      if (rs >= e || re <= s) continue;
      const startH = rs <= s ? 0 : rs.getHours();
      const endH = re >= e ? 24 : re.getHours() + (re.getMinutes() > 0 ? 1 : 0);
      // Una reserva de varios días ocupa el día entero del medio: no estira la grilla por eso.
      if (rs <= s && re >= e) continue;
      if (rs > s) from = Math.min(from, startH);
      if (re < e) to = Math.max(to, endH);
    }
  }
  return [Math.max(0, from), Math.min(24, Math.max(to, from + 1))];
}

/** Los bloques ocupados de un día, recortados a las horas de la grilla. */
export function blocksForDay(reservations: BusyReservation[], day: Date, hours: [number, number]): DayBlock[] {
  const s = dayStart(day);
  const gridStart = new Date(s.getFullYear(), s.getMonth(), s.getDate(), hours[0]);
  const gridEnd = new Date(s.getFullYear(), s.getMonth(), s.getDate(), hours[1]);
  const total = gridEnd.getTime() - gridStart.getTime();
  const out: DayBlock[] = [];
  for (const r of reservations) {
    if (!isBusy(r)) continue;
    const rs = toDate(r.startDate);
    const re = toDate(r.endDate);
    if (rs >= gridEnd || re <= gridStart) continue;
    const a = rs < gridStart ? gridStart : rs;
    const b = re > gridEnd ? gridEnd : re;
    out.push({
      id: r.id,
      status: r.status,
      who: r.user?.name || "Otra persona",
      start: rs,
      end: re,
      top: (a.getTime() - gridStart.getTime()) / total,
      height: (b.getTime() - a.getTime()) / total,
      fromBefore: rs < s,
      toAfter: re > addDays(s, 1),
    });
  }
  return out.sort((x, y) => x.top - y.top);
}

/** Cuántos tramos de media hora tiene la grilla. */
export function slotCount(hours: [number, number]): number {
  return ((hours[1] - hours[0]) * 60) / SLOT_MINUTES;
}

/** El comienzo del tramo número `slot` de ese día. */
export function slotStart(day: Date, slot: number, hours: [number, number]): Date {
  const s = dayStart(day);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate(), hours[0], slot * SLOT_MINUTES);
}

/** Del tramo `a` al tramo `b` (los dos incluidos, en cualquier orden): salida y vuelta. */
export function slotRange(day: Date, a: number, b: number, hours: [number, number]): { start: Date; end: Date } {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const start = slotStart(day, lo, hours);
  return { start, end: new Date(slotStart(day, hi, hours).getTime() + SLOT_MINUTES * 60_000) };
}

/** La primera reserva que se pisa con ese horario, o null si está libre. 10 a 12 y 12 a 14 no se pisan. */
export function firstConflict<T extends BusyReservation>(reservations: T[], start: Date, end: Date): T | null {
  return (
    reservations.find((r) => isBusy(r) && start < toDate(r.endDate) && toDate(r.startDate) < end) ?? null
  );
}

/** ¿Está ocupado ese tramo de media hora? */
export function slotIsBusy(reservations: BusyReservation[], day: Date, slot: number, hours: [number, number]): boolean {
  const start = slotStart(day, slot, hours);
  return firstConflict(reservations, start, new Date(start.getTime() + SLOT_MINUTES * 60_000)) !== null;
}

/**
 * Al arrastrar desde `anchor` hasta `target`: el último tramo al que se llega sin pisar una reserva ni el pasado.
 * Si el arrastre choca con algo, la selección se queda justo antes.
 */
export function clampDrag(
  reservations: BusyReservation[],
  day: Date,
  anchor: number,
  target: number,
  hours: [number, number],
  now: Date = new Date()
): number {
  const step = target >= anchor ? 1 : -1;
  let last = anchor;
  for (let s = anchor + step; step > 0 ? s <= target : s >= target; s += step) {
    if (slotIsBusy(reservations, day, s, hours) || slotIsPast(day, s, hours, now)) break;
    last = s;
  }
  return last;
}

/** ¿Ya terminó ese tramo? */
export function slotIsPast(day: Date, slot: number, hours: [number, number], now: Date = new Date()): boolean {
  return slotStart(day, slot, hours).getTime() + SLOT_MINUTES * 60_000 <= now.getTime();
}

/** "AAAA-MM-DDTHH:MM" para los campos de fecha y hora. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Lee lo que tiene un campo de fecha y hora. null si está vacío o mal. */
export function fromLocalInput(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** "3 h", "1 h 30 min", "45 min", "2 días y 3 h". */
export function durationLabel(start: Date, end: Date): string {
  const min = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (min <= 0) return "";
  const days = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  const rest = parts.join(" ");
  if (!days) return rest;
  const d = days === 1 ? "1 día" : `${days} días`;
  return rest ? `${d} y ${rest}` : d;
}

/** Hora corta para los bloques angostos de la grilla: "8", "8:30", "14". */
export function horaCorta(d: Date): string {
  return d.getMinutes() ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` : String(d.getHours());
}

/** Lo que dice un bloque: "8 a 10 h", y si viene de otro día o sigue al otro, "Hasta 11 h" o "Desde 16 h". */
export function blockTimeLabel(start: Date, end: Date, fromBefore: boolean, toAfter: boolean): string {
  if (fromBefore && toAfter) return "Todo el día";
  if (fromBefore) return `Hasta ${horaCorta(end)} h`;
  if (toAfter) return `Desde ${horaCorta(start)} h`;
  return `${horaCorta(start)} a ${horaCorta(end)} h`;
}
