// Licencias y vacaciones del personal: los tipos, la cuenta de días y el calendario del mes.
// Sin base de datos, para poder probarlo solo. Las fechas son días de calendario: "AAAA-MM-DD"
// (en la base, a la medianoche UTC de ese día), y una licencia incluye su primer y su último día.

export type LeaveKind =
  | "VACACIONES"
  | "ENFERMEDAD"
  | "FAMILIAR_ENFERMO"
  | "MATERNIDAD_PATERNIDAD"
  | "ESTUDIO"
  | "DUELO"
  | "MATRIMONIO"
  | "SIN_GOCE"
  | "OTRA";

/** Los tipos, en el orden en que se eligen. `tone` es el color del calendario de ausencias. */
export const LEAVE_KINDS: { value: LeaveKind; label: string; short: string; tone: string }[] = [
  { value: "VACACIONES", label: "Vacaciones", short: "Vacaciones", tone: "sky" },
  { value: "ENFERMEDAD", label: "Licencia médica", short: "Médica", tone: "rose" },
  { value: "FAMILIAR_ENFERMO", label: "Atención de familiar enfermo", short: "Familiar", tone: "amber" },
  { value: "MATERNIDAD_PATERNIDAD", label: "Maternidad o paternidad", short: "Maternidad/paternidad", tone: "violet" },
  { value: "ESTUDIO", label: "Examen o estudio", short: "Estudio", tone: "emerald" },
  { value: "DUELO", label: "Duelo", short: "Duelo", tone: "slate" },
  { value: "MATRIMONIO", label: "Matrimonio", short: "Matrimonio", tone: "pink" },
  { value: "SIN_GOCE", label: "Sin goce de haberes", short: "Sin goce", tone: "stone" },
  { value: "OTRA", label: "Otra licencia", short: "Otra", tone: "indigo" },
];

const KIND_BY_VALUE = new Map(LEAVE_KINDS.map((k) => [k.value, k]));

export const isLeaveKind = (v: string | null | undefined): v is LeaveKind => KIND_BY_VALUE.has(v as LeaveKind);
export const leaveKindLabel = (v: string) => KIND_BY_VALUE.get(v as LeaveKind)?.label ?? "Licencia";
export const leaveKindShort = (v: string) => KIND_BY_VALUE.get(v as LeaveKind)?.short ?? "Licencia";
export const leaveKindTone = (v: string) => KIND_BY_VALUE.get(v as LeaveKind)?.tone ?? "indigo";

/** La situación del legajo mientras dura: las vacaciones son "Vacaciones"; todo lo demás, "Licencia". */
export const statusForLeave = (kind: string): "VACACIONES" | "LICENCIA" => (kind === "VACACIONES" ? "VACACIONES" : "LICENCIA");

/** Las clases de cada color (fondo del bloque, punto de la leyenda). Completas, para que Tailwind las vea. */
export const LEAVE_TONE_CLASS: Record<string, { cell: string; dot: string }> = {
  sky: { cell: "bg-sky-500/80 text-white", dot: "bg-sky-500" },
  rose: { cell: "bg-rose-500/80 text-white", dot: "bg-rose-500" },
  amber: { cell: "bg-amber-500/80 text-white", dot: "bg-amber-500" },
  violet: { cell: "bg-violet-500/80 text-white", dot: "bg-violet-500" },
  emerald: { cell: "bg-emerald-600/80 text-white", dot: "bg-emerald-600" },
  slate: { cell: "bg-slate-500/80 text-white", dot: "bg-slate-500" },
  pink: { cell: "bg-pink-500/80 text-white", dot: "bg-pink-500" },
  stone: { cell: "bg-stone-500/80 text-white", dot: "bg-stone-500" },
  indigo: { cell: "bg-indigo-500/80 text-white", dot: "bg-indigo-500" },
};

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" → la medianoche UTC de ese día. null si no es una fecha válida. */
export function dayToDate(day: string | null | undefined): Date | null {
  if (!day || !ISO.test(day)) return null;
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day ? null : d;
}

/** Una fecha guardada (medianoche UTC) → "AAAA-MM-DD". */
export const dateToDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Días entre dos fechas, los dos incluidos: del 3 al 5 son 3 días. */
export function leaveDays(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
}

/** Los días de la licencia que caen entre `from` y `to` (incluidos). */
export function daysWithin(start: Date, end: Date, from: Date, to: Date): number {
  const a = start > from ? start : from;
  const b = end < to ? end : to;
  return b < a ? 0 : leaveDays(a, b);
}

export type LeaveLike = { kind: string; startDate: Date; endDate: Date };

/** Cuántos días tomó en el año, en total y por tipo (solo los tipos con días, en el orden de la lista). */
export function yearSummary(leaves: LeaveLike[], year: number): { total: number; byKind: { kind: LeaveKind; label: string; days: number }[] } {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31));
  const per = new Map<string, number>();
  for (const l of leaves) {
    const d = daysWithin(l.startDate, l.endDate, from, to);
    if (d > 0) per.set(l.kind, (per.get(l.kind) ?? 0) + d);
  }
  const byKind = LEAVE_KINDS.filter((k) => per.has(k.value)).map((k) => ({ kind: k.value, label: k.label, days: per.get(k.value)! }));
  const other = [...per.entries()].filter(([k]) => !isLeaveKind(k)).reduce((n, [, d]) => n + d, 0);
  if (other) byKind.push({ kind: "OTRA", label: "Otra licencia", days: other });
  return { total: byKind.reduce((n, k) => n + k.days, 0), byKind };
}

export const MAX_LEAVE_DAYS = 366;

/** Revisa lo que se carga al registrar una licencia. Devuelve las fechas o el error para mostrar. */
export function readLeaveInput(input: { kind?: string | null; startDate?: string | null; endDate?: string | null; notes?: string | null }):
  | { ok: true; data: { kind: LeaveKind; startDate: Date; endDate: Date; notes: string | null } }
  | { ok: false; error: string } {
  if (!isLeaveKind(input.kind)) return { ok: false, error: "Elegí el tipo de licencia." };
  const startDate = dayToDate(input.startDate);
  const endDate = dayToDate(input.endDate);
  if (!startDate) return { ok: false, error: "Elegí el primer día de la licencia." };
  if (!endDate) return { ok: false, error: "Elegí el último día de la licencia." };
  if (endDate < startDate) return { ok: false, error: "El último día tiene que ser el mismo o después del primero." };
  if (leaveDays(startDate, endDate) > MAX_LEAVE_DAYS) return { ok: false, error: "Una licencia no puede durar más de un año. Cargala en partes." };
  const notes = (input.notes ?? "").trim().replace(/\s+/g, " ").slice(0, 300) || null;
  return { ok: true, data: { kind: input.kind, startDate, endDate, notes } };
}

/** ¿Se pisan dos licencias? Del 1 al 5 y del 5 al 8 se pisan (el 5 está en las dos). */
export const leavesOverlap = (a: { startDate: Date; endDate: Date }, b: { startDate: Date; endDate: Date }) =>
  a.startDate <= b.endDate && b.startDate <= a.endDate;

/** El mes que se pide ("AAAA-MM"), o el de hoy si no viene o está mal. */
export function monthFromParam(param: string | null | undefined, today: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  const y = m ? Number(m[1]) : Number(today.slice(0, 4));
  const mo = m ? Number(m[2]) : Number(today.slice(5, 7));
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12) return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  return { year: y, month: mo };
}

export const monthParam = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** El mes anterior y el siguiente, para las flechas. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export type MonthDay = { day: number; iso: string; weekday: number; weekend: boolean };

/** Los días del mes, con el día de la semana (lunes 0 … domingo 6). */
export function monthDays(year: number, month: number): MonthDay[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1, i + 1));
    const weekday = (d.getUTCDay() + 6) % 7;
    return { day: i + 1, iso: d.toISOString().slice(0, 10), weekday, weekend: weekday >= 5 };
  });
}

export type AbsenceSpan = { id: string; kind: string; notes: string | null; from: number; to: number; startDate: Date; endDate: Date };

/**
 * Para el calendario de ausencias: los tramos de cada licencia dentro del mes, como días del mes (del 1 al 31).
 * Las licencias que empiezan antes o terminan después quedan recortadas al mes.
 */
export function spansInMonth(
  leaves: { id: string; kind: string; notes?: string | null; startDate: Date; endDate: Date }[],
  year: number,
  month: number
): AbsenceSpan[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return leaves
    .filter((l) => l.startDate <= last && l.endDate >= first)
    .map((l) => ({
      id: l.id,
      kind: l.kind,
      notes: l.notes ?? null,
      startDate: l.startDate,
      endDate: l.endDate,
      from: (l.startDate < first ? first : l.startDate).getUTCDate(),
      to: (l.endDate > last ? last : l.endDate).getUTCDate(),
    }))
    .sort((a, b) => a.from - b.from);
}
