import type { Role } from "@prisma/client";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { canEditLugares } from "@/lib/barrios";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";

// Recorridas por un barrio: cómo se arma la lista de a quién visitar, el orden por calle, los resultados
// de cada visita y quién puede hacer qué. Sin base de datos (lo usan la página, los servicios y las pruebas).

/** Por qué alguien entra en la lista de una recorrida. Se pueden elegir varios: entra quien cumpla alguno. */
export const RECORRIDA_MOTIVOS = [
  { key: "quietos", label: "Expediente sin movimiento", hint: "Expedientes abiertos sin intervenciones hace 30 días o más." },
  { key: "urgentes", label: "Expediente urgente o de prioridad alta", hint: "Expedientes abiertos marcados como urgentes o de prioridad alta." },
  { key: "seguimientos", label: "Seguimiento agendado", hint: "Seguimientos de expedientes vencidos o para los próximos 14 días." },
  { key: "tormenta", label: "Ficha de tormenta sin entrega", hint: "Fichas de emergencia climática que todavía no recibieron nada." },
  { key: "sinTelefono", label: "Sin teléfono cargado", hint: "Para pedir un teléfono de contacto en la visita." },
  { key: "programa", label: "En un programa", hint: "Personas dadas de alta en el programa que elijas." },
] as const;

export type RecorridaMotivo = (typeof RECORRIDA_MOTIVOS)[number]["key"];

/** Como mucho, cuántas personas entran en una recorrida (una lista más larga no se recorre en un día). */
export const RECORRIDA_MAX = 150;
/** Días hacia adelante para los seguimientos agendados. */
export const SEGUIMIENTO_DIAS = 14;
/** Por defecto, se saca de la lista a quien ya se visitó en estos últimos días. */
export const YA_VISITADOS_DIAS = 30;

export type RecorridaCriteria = {
  motivos: RecorridaMotivo[];
  /** Columna del programa (prog_…) cuando se eligió "En un programa". */
  programa: string | null;
  /** Solo las direcciones que contienen este texto (una calle). */
  calle: string | null;
  /** Sacar a quienes se visitaron hace menos de YA_VISITADOS_DIAS días. */
  sinVisitados: boolean;
};

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const many = (v: unknown): string[] => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]).map(String);

/** Lee los criterios de la dirección (?motivo=quietos&motivo=urgentes&programa=…&calle=…; visitados=1 incluye a los ya visitados). */
export function parseRecorridaCriteria(sp: Record<string, unknown>): RecorridaCriteria {
  const valid = new Set<string>(RECORRIDA_MOTIVOS.map((m) => m.key));
  let motivos = Array.from(new Set(many(sp.motivo).filter((m) => valid.has(m)))) as RecorridaMotivo[];
  const programaRaw = String(one(sp.programa) ?? "");
  const programa = PADRON_PROGRAMS.some((p) => p.column === programaRaw) ? programaRaw : null;
  if (!programa) motivos = motivos.filter((m) => m !== "programa");
  else if (!motivos.includes("programa")) motivos.push("programa");
  const calle = String(one(sp.calle) ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || null;
  return { motivos, programa, calle, sinVisitados: String(one(sp.visitados) ?? "") !== "1" };
}

/** Los criterios, para volver a ponerlos en la dirección. */
/** Lo que se marca de entrada la primera vez que se abre "Preparar recorrida". */
export const MOTIVOS_SUGERIDOS: RecorridaMotivo[] = ["quietos", "urgentes", "seguimientos", "tormenta"];

export function criteriaToParams(c: RecorridaCriteria): URLSearchParams {
  const p = new URLSearchParams();
  for (const m of c.motivos) if (m !== "programa") p.append("motivo", m);
  if (c.programa) p.set("programa", c.programa);
  if (c.calle) p.set("calle", c.calle);
  if (!c.sinVisitados) p.set("visitados", "1");
  return p;
}

// ---------------------------------------------------------------------------
// Orden por calle
// ---------------------------------------------------------------------------

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Calle y altura de una dirección escrita a mano: "Av. Pte. Perón 2345 dpto 3" → { calle: "av pte peron", altura: 2345 }.
 * Si no tiene altura, la calle es todo el texto. Sirve para ordenar, no para mostrar.
 */
export function splitStreet(direccion: string | null | undefined): { calle: string; altura: number | null } {
  const text = sinTildes(String(direccion ?? ""))
    .toLowerCase()
    .replace(/[.,;:#°º"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return { calle: "", altura: null };
  const m = text.match(/^(.*?\D)\s*(\d{1,5})(?:\D|$)/);
  if (m && m[1].trim().replace(/\b(n|nro|numero)$/, "").trim()) {
    return { calle: m[1].trim().replace(/\s+(n|nro|numero)$/, "").trim(), altura: Number(m[2]) };
  }
  return { calle: text, altura: null };
}

/**
 * Ordena para caminar: por calle (alfabético) y, en cada calle, primero una vereda (alturas pares) subiendo y
 * después la otra (impares) bajando, para no cruzar de vereda en cada casa. Sin dirección, al final.
 */
export function sortByStreet<T extends { direccion: string | null }>(rows: T[]): T[] {
  const keyed = rows.map((r, i) => ({ r, i, ...splitStreet(r.direccion) }));
  keyed.sort((a, b) => {
    if (!a.calle !== !b.calle) return a.calle ? -1 : 1;
    const byStreet = a.calle.localeCompare(b.calle, "es");
    if (byStreet) return byStreet;
    if ((a.altura === null) !== (b.altura === null)) return a.altura === null ? 1 : -1;
    if (a.altura !== null && b.altura !== null) {
      const sa = a.altura % 2;
      const sb = b.altura % 2;
      if (sa !== sb) return sa - sb;
      return sa === 0 ? a.altura - b.altura : b.altura - a.altura;
    }
    return a.i - b.i;
  });
  return keyed.map((k) => k.r);
}

// ---------------------------------------------------------------------------
// Resultado de cada visita
// ---------------------------------------------------------------------------

export const VISITA_RESULTADOS = [
  { key: "PENDIENTE", label: "Sin visitar", tone: "muted" },
  { key: "VISITADA", label: "Visitada", tone: "green" },
  { key: "NO_ESTABA", label: "No estaba", tone: "amber" },
  { key: "NO_QUISO", label: "No quiso atender", tone: "amber" },
  { key: "SE_MUDO", label: "Se mudó", tone: "rose" },
  { key: "OTRO", label: "Otro", tone: "muted" },
] as const;

export type VisitaResultado = (typeof VISITA_RESULTADOS)[number]["key"];

export const isVisitaResultado = (v: unknown): v is VisitaResultado => VISITA_RESULTADOS.some((r) => r.key === v);
export const visitaResultadoLabel = (key: string) => VISITA_RESULTADOS.find((r) => r.key === key)?.label ?? "Otro";

export const RECORRIDA_ESTADOS = { PLANIFICADA: "Planificada", HECHA: "Hecha" } as const;
export type RecorridaEstado = keyof typeof RECORRIDA_ESTADOS;

/** Una nota de visita, recortada. */
export const cleanNota = (v: unknown, max = 1000) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);

/** "2026-10-30" → fecha a la medianoche UTC (como las demás fechas de calendario). Null si no es una fecha. */
export function parseFechaRecorrida(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

// ---------------------------------------------------------------------------
// Quién puede hacer qué
// ---------------------------------------------------------------------------

type Actor = { id?: string | null; role?: Role | string | null };
type RecorridaOwner = { createdById: string | null; equipoIds: string[] };

/** Arman recorridas y anotan visitas quienes cargan datos sociales (no Auditoría ni el relevador). */
export const canPlanRecorridas = (role?: Role | string | null) => canEditLugares(role);

/** Cambian la fecha, el equipo o la terminan: quien la armó, quien sale en ella o la conducción. */
export function canManageRecorrida(user: Actor, r: RecorridaOwner): boolean {
  if (!canPlanRecorridas(user.role)) return false;
  if (MANAGEMENT_ROLES.includes(user.role as Role)) return true;
  return Boolean(user.id) && (user.id === r.createdById || r.equipoIds.includes(user.id!));
}

/** La borra quien la armó o la conducción. */
export function canDeleteRecorrida(user: Actor, r: RecorridaOwner): boolean {
  if (!canPlanRecorridas(user.role)) return false;
  return MANAGEMENT_ROLES.includes(user.role as Role) || (Boolean(user.id) && user.id === r.createdById);
}

/** El referente de cada barrio lo elige la conducción. */
export const canAssignReferente = (role?: Role | string | null) => MANAGEMENT_ROLES.includes(role as Role);

/** Pueden ser referentes o salir a una recorrida: los usuarios que cargan datos sociales. */
export const canBeInRecorrida = (role?: Role | string | null) => canPlanRecorridas(role);
