// Iniciales y color del círculo de cada persona o usuario. El color sale siempre del mismo dato
// (el id o el DNI), así la misma persona tiene el mismo color en todas las pantallas.

/** Palabras que no cuentan para las iniciales ("María de los Ángeles" → MÁ). */
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "dos", "van", "von"]);

function words(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/[\s,.-]+/)
    .map((w) => w.trim())
    .filter((w) => w && !PARTICLES.has(w.toLowerCase()));
}

const firstLetter = (w: string | undefined) => (w ? Array.from(w)[0].toLocaleUpperCase("es-AR") : "");

/**
 * Hasta dos iniciales. Con nombre y apellido separados: la primera de cada uno.
 * Con el nombre entero: la primera y la última palabra; si viene como "Apellido, Nombre",
 * primero el nombre (como se lee "Juan Pérez").
 */
export function initialsOf(name: string | null | undefined, lastName?: string | null): string {
  if (lastName !== undefined) {
    const res = firstLetter(words(name)[0]) + firstLetter(words(lastName)[0]);
    return res || "?";
  }
  const raw = (name ?? "").trim();
  if (!raw) return "?";
  const comma = raw.indexOf(",");
  if (comma > 0) {
    const res = firstLetter(words(raw.slice(comma + 1))[0]) + firstLetter(words(raw.slice(0, comma))[0]);
    if (res) return res;
  }
  const ws = words(raw);
  if (ws.length === 0) return firstLetter(raw) || "?";
  return firstLetter(ws[0]) + (ws.length > 1 ? firstLetter(ws[ws.length - 1]) : "");
}

/**
 * Colores del círculo: fondo claro y letra oscura del mismo tono (y al revés en modo oscuro), todos con
 * contraste de sobra. No usa rojo ni ámbar, que en la app quieren decir urgente o "sin movimiento".
 * Las clases van escritas enteras para que Tailwind las incluya.
 */
export const INITIALS_COLORS = [
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
  "bg-slate-200 text-slate-800 dark:bg-slate-500/25 dark:text-slate-200",
] as const;

/** Siempre el mismo número para el mismo texto (hash FNV-1a de 32 bits). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Las clases de color para ese id, DNI o nombre. */
export function initialsColor(seed: string | null | undefined): string {
  const key = (seed ?? "").trim().toLowerCase();
  if (!key) return INITIALS_COLORS[INITIALS_COLORS.length - 1];
  return INITIALS_COLORS[hash(key) % INITIALS_COLORS.length];
}
