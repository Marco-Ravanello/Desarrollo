// Bajar las intervenciones por período y por área (idea 135). Sin base de datos, para poder probarlo solo.
// Antes se bajaban todas juntas; con el tiempo la descarga se iba a poner lenta o a fallar.

/** Más que esto en una sola planilla no conviene: se pide un período más corto o un área. */
export const EXPORT_MAX_ROWS = 20_000;
/** El período más largo que se puede pedir de una vez (un año y un día, para "este año" bisiesto). */
export const EXPORT_MAX_DAYS = 366;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Si es un día válido "AAAA-MM-DD" (no el 30 de febrero). */
export function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !DAY.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** La medianoche de ese día en Argentina (UTC-3, sin horario de verano). */
const startOfDayAR = (day: string) => new Date(`${day}T00:00:00-03:00`);

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

export type ExportRange = { desde: string; hasta: string };

/** Atajos para elegir el período. `today` es "AAAA-MM-DD" en Argentina. */
export function exportPresets(today: string): { key: string; label: string; range: ExportRange }[] {
  const y = Number(today.slice(0, 4));
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const prevMonthEnd = addDays(firstOfMonth, -1);
  return [
    { key: "mes", label: "Este mes", range: { desde: firstOfMonth, hasta: today } },
    { key: "mes-pasado", label: "Mes pasado", range: { desde: `${prevMonthEnd.slice(0, 7)}-01`, hasta: prevMonthEnd } },
    { key: "90", label: "Últimos 90 días", range: { desde: addDays(today, -89), hasta: today } },
    { key: "anio", label: `Año ${y}`, range: { desde: `${y}-01-01`, hasta: today } },
  ];
}

export type ExportCheck =
  | { ok: true; from: Date; toExclusive: Date; desde: string; hasta: string }
  | { ok: false; error: string };

/** Revisa el período pedido y arma las fechas para buscar (desde la medianoche del primer día hasta el fin del último). */
export function checkExportRange(input: { desde?: unknown; hasta?: unknown }, today: string): ExportCheck {
  if (!isDay(input.desde) || !isDay(input.hasta)) return { ok: false, error: "Elegí la fecha de inicio y la de fin." };
  const { desde, hasta } = input;
  if (desde > hasta) return { ok: false, error: "La fecha de inicio tiene que ser anterior a la de fin." };
  if (desde > today) return { ok: false, error: "El período empieza después de hoy: no hay intervenciones para bajar." };
  if (daysBetween(desde, hasta) + 1 > EXPORT_MAX_DAYS) return { ok: false, error: "Elegí un período de hasta un año." };
  return { ok: true, from: startOfDayAR(desde), toExclusive: startOfDayAR(addDays(hasta, 1)), desde, hasta };
}

const short = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

/** "del 01/11/2026 al 12/11/2026, Protección Social" (para Auditoría y el aviso). */
export function exportRangeText(r: ExportRange, areaName?: string | null): string {
  const period = r.desde === r.hasta ? `del ${short(r.desde)}` : `del ${short(r.desde)} al ${short(r.hasta)}`;
  return areaName ? `${period}, ${areaName}` : `${period}, todas las áreas`;
}

/** Nombre del archivo: "Intervenciones_2026-11-01_a_2026-11-12_Proteccion_Social.xlsx". */
export function exportFileName(r: ExportRange, areaName?: string | null): string {
  const area = areaName
    ? "_" + areaName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    : "";
  return `Intervenciones_${r.desde}_a_${r.hasta}${area}.xlsx`;
}
