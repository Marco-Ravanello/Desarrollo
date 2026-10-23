// Fechas y horas como se leen en Argentina, siempre en hora argentina aunque el servidor esté en otra zona:
// "22/10/2026", "15:39", "22/10/2026 15:39".

export const TZ_AR = "America/Argentina/Buenos_Aires";

type Fecha = Date | string | number | null | undefined;

const dia = new Intl.DateTimeFormat("es-AR", { timeZone: TZ_AR, day: "2-digit", month: "2-digit", year: "numeric" });
const diaSinAnio = new Intl.DateTimeFormat("es-AR", { timeZone: TZ_AR, day: "2-digit", month: "2-digit" });
const hora = new Intl.DateTimeFormat("es-AR", { timeZone: TZ_AR, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const largo = new Intl.DateTimeFormat("es-AR", { timeZone: TZ_AR, weekday: "long", day: "numeric", month: "long", year: "numeric" });
// Las fechas que se eligen en un calendario (vencimientos, inicio de un convenio) se guardan a la medianoche UTC:
// se muestran en UTC para que no aparezcan un día antes.
const calendario = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

function aFecha(d: Fecha): Date | null {
  if (d === null || d === undefined || d === "") return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

/** "22/10/2026", en hora argentina. Vacío si no hay fecha. */
export function formatFecha(d: Fecha): string {
  const x = aFecha(d);
  return x ? dia.format(x) : "";
}

/** "22/10", en hora argentina. */
export function formatFechaCorta(d: Fecha): string {
  const x = aFecha(d);
  return x ? diaSinAnio.format(x) : "";
}

/** "15:39", en hora argentina y en 24 horas. */
export function formatHora(d: Fecha): string {
  const x = aFecha(d);
  return x ? hora.format(x) : "";
}

/** "22/10/2026 15:39", en hora argentina y en 24 horas. */
export function formatFechaHora(d: Fecha): string {
  const x = aFecha(d);
  return x ? `${dia.format(x)} ${hora.format(x)}` : "";
}

/** "jueves, 22 de octubre de 2026". */
export function formatFechaLarga(d: Fecha): string {
  const x = aFecha(d);
  return x ? largo.format(x) : "";
}

/** Para fechas elegidas en un calendario (sin hora): "03/12/2026". */
export function formatFechaCalendario(d: Fecha): string {
  const x = aFecha(d);
  return x ? calendario.format(x) : "";
}

const isoAR = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR, year: "numeric", month: "2-digit", day: "2-digit" });

/** El día en Argentina, como "AAAA-MM-DD". */
export function diaAR(d: Fecha = new Date()): string {
  const x = aFecha(d);
  return x ? isoAR.format(x) : "";
}

/**
 * El día de un vencimiento, como "AAAA-MM-DD". Los que se eligieron con un calendario sin hora quedaron
 * a la medianoche UTC (las 21 del día anterior en Argentina): esos se toman en UTC para no correrse un día.
 */
export function diaDeVencimiento(d: Fecha): string {
  const x = aFecha(d);
  if (!x) return "";
  const medianocheUtc = x.getUTCHours() === 0 && x.getUTCMinutes() === 0 && x.getUTCSeconds() === 0 && x.getUTCMilliseconds() === 0;
  return medianocheUtc ? x.toISOString().slice(0, 10) : isoAR.format(x);
}

/** "22/10" para un vencimiento (ver diaDeVencimiento). */
export function formatVencimiento(d: Fecha): string {
  const dia = diaDeVencimiento(d);
  return dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : "";
}

/** Días entre dos fechas "AAAA-MM-DD" (positivo si b es posterior). */
export function diasEntre(a: string, b: string): number {
  const ms = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86400000);
}
