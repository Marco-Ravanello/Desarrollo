// Filtros guardados de la lista de Expedientes: cada persona guarda con un nombre la búsqueda que usa seguido.
// Sin base de datos, para poder probarlo solo.

export type FiltroGuardado = { nombre: string; consulta: string };

export const FILTROS_MAX = 10;
export const FILTRO_NOMBRE_MAX = 40;

/** Los filtros de la lista que se guardan (la página no). */
const CLAVES = ["q", "area", "status", "priority", "assigned", "quiet", "label"] as const;

/** La búsqueda de la lista sin la página ni valores vacíos o "todos", en un orden fijo. "" si no hay filtros. */
export function consultaDeFiltros(params: Record<string, string | string[] | undefined | null>): string {
  const out = new URLSearchParams();
  for (const k of CLAVES) {
    const raw = params[k];
    const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (!v || v === "all") continue;
    if (k === "quiet" && v !== "1") continue;
    out.set(k, v.slice(0, 120));
  }
  return out.toString();
}

/** Lee lo guardado en la base y descarta lo que no sirve. */
export function parseFiltros(raw: unknown): FiltroGuardado[] {
  if (!Array.isArray(raw)) return [];
  const out: FiltroGuardado[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const nombre = typeof (item as FiltroGuardado).nombre === "string" ? (item as FiltroGuardado).nombre.trim().slice(0, FILTRO_NOMBRE_MAX) : "";
    const consulta = typeof (item as FiltroGuardado).consulta === "string" ? consultaDeFiltros(Object.fromEntries(new URLSearchParams((item as FiltroGuardado).consulta))) : "";
    if (nombre && consulta && !out.some((f) => f.nombre.toLowerCase() === nombre.toLowerCase())) out.push({ nombre, consulta });
    if (out.length >= FILTROS_MAX) break;
  }
  return out;
}

/**
 * Suma un filtro (o lo reemplaza si ya hay uno con ese nombre). Devuelve la lista nueva o un error para mostrar.
 */
export function agregarFiltro(
  actuales: FiltroGuardado[],
  nombreRaw: string,
  consultaRaw: string
): { ok: true; filtros: FiltroGuardado[] } | { ok: false; error: string } {
  const nombre = String(nombreRaw ?? "").trim().replace(/\s+/g, " ");
  if (!nombre) return { ok: false, error: "Poné un nombre para el filtro." };
  if (nombre.length > FILTRO_NOMBRE_MAX) return { ok: false, error: `El nombre puede tener hasta ${FILTRO_NOMBRE_MAX} letras.` };
  const consulta = consultaDeFiltros(Object.fromEntries(new URLSearchParams(String(consultaRaw ?? ""))));
  if (!consulta) return { ok: false, error: "Elegí algún filtro antes de guardarlo." };
  const sinEse = actuales.filter((f) => f.nombre.toLowerCase() !== nombre.toLowerCase());
  if (sinEse.length >= FILTROS_MAX) return { ok: false, error: `Se pueden guardar hasta ${FILTROS_MAX} filtros. Borrá alguno primero.` };
  return { ok: true, filtros: [...sinEse, { nombre, consulta }] };
}

export function quitarFiltro(actuales: FiltroGuardado[], nombre: string): FiltroGuardado[] {
  return actuales.filter((f) => f.nombre.toLowerCase() !== String(nombre ?? "").trim().toLowerCase());
}
