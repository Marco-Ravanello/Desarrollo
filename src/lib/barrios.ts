import type { Role } from "@prisma/client";
import { MANAGEMENT_ROLES, canEditSocialRecords, isEmergencySurveyor } from "@/lib/permissions";

// Los barrios de Tres de Febrero (la lista la pasó la Subsecretaría el 27/10/2026) y cómo reconocerlos
// cuando están escritos a mano en el padrón o en una ficha: sin importar tildes, mayúsculas,
// la palabra "barrio" adelante ni algunos nombres de uso común (Fuerte Apache, 11 de Septiembre…).
// Sin base de datos: lo usan la página de cada barrio, la ficha de tormenta y los formularios.

export const BARRIOS_3F = [
  "Capitán Bermúdez",
  "Caseros",
  "Churruca",
  "Ciudad Jardín",
  "Ciudadela",
  "Derqui",
  "Ejército de los Andes",
  "Escalada",
  "Esperanza",
  "Evita",
  "Favelita",
  "José Ingenieros",
  "Libertador",
  "Loma Hermosa",
  "Los Rusos",
  "Maldonado",
  "Martín Coronado",
  "Matienzo",
  "Mercado",
  "Once de Septiembre",
  "Pablo Podestá",
  "Puerta 8",
  "Remedios de Escalada",
  "Sáenz Peña",
  "San Eduardo",
  "Santos Lugares",
  "Villa Bosch",
  "Villa Herminia",
  "Villa Raffo",
] as const;

export type Barrio3F = (typeof BARRIOS_3F)[number];

/** Otras formas de escribir un barrio que se usan en las planillas. */
const ALIASES: Record<string, Barrio3F> = {
  "fuerte apache": "Ejército de los Andes",
  "fuerte apache (ejercito de los andes)": "Ejército de los Andes",
  "ejercito de los andes (fuerte apache)": "Ejército de los Andes",
  "edla": "Ejército de los Andes",
  "los russos": "Los Rusos",
  "11 de septiembre": "Once de Septiembre",
  "11 de setiembre": "Once de Septiembre",
  "once de setiembre": "Once de Septiembre",
  "el libertador": "Libertador",
  "puerta ocho": "Puerta 8",
  "ciudad jardin lomas del palomar": "Ciudad Jardín",
  "villa rafo": "Villa Raffo",
  "remedios escalada": "Remedios de Escalada",
};

/**
 * Forma comparable de un nombre: sin tildes, en minúsculas, sin "barrio" adelante y con los
 * espacios ordenados. La base usa la misma regla (ver barrioKeySql en services/barrios.ts).
 */
export function barrioKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^barrio\s+/, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, Barrio3F>([
  ...BARRIOS_3F.map((b) => [barrioKey(b), b] as const),
  ...Object.entries(ALIASES).map(([k, b]) => [barrioKey(k), b] as const),
]);

/** El barrio de la lista que corresponde a un texto escrito a mano, o null si no es ninguno. */
export function matchBarrio(value: string | null | undefined): Barrio3F | null {
  const k = barrioKey(value);
  return k ? BY_KEY.get(k) ?? null : null;
}

/**
 * El barrio de una persona del padrón: su columna "barrio" si es uno de la lista y, si no, la "localidad"
 * (hay planillas que traen el barrio en esa columna). Null si ninguna es de la lista.
 */
export function barrioOfRow(barrio: string | null | undefined, localidad: string | null | undefined): Barrio3F | null {
  return matchBarrio(barrio) ?? matchBarrio(localidad);
}

/** Para la dirección de la página: "Sáenz Peña" → "saenz-pena". */
export function barrioSlug(barrio: string): string {
  return barrioKey(barrio).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function barrioFromSlug(slug: string | null | undefined): Barrio3F | null {
  const s = decodeURIComponent(slug ?? "").toLowerCase();
  return BARRIOS_3F.find((b) => barrioSlug(b) === s) ?? null;
}

// ---------------------------------------------------------------------------
// Lugares de referencia de cada barrio (escuela, salita, comedor…), con quién hablar.
// ---------------------------------------------------------------------------

export const LUGAR_TIPOS = [
  { key: "ESCUELA", label: "Escuela" },
  { key: "JARDIN", label: "Jardín" },
  { key: "SALITA", label: "Salita / CAPS" },
  { key: "COMEDOR", label: "Comedor o merendero" },
  { key: "CLUB", label: "Club" },
  { key: "IGLESIA", label: "Iglesia o parroquia" },
  { key: "SOCIEDAD_FOMENTO", label: "Sociedad de fomento" },
  { key: "CENTRO_COMUNITARIO", label: "Centro comunitario" },
  { key: "MUNICIPAL", label: "Dependencia municipal" },
  { key: "OTRO", label: "Otro" },
] as const;

export type LugarTipo = (typeof LUGAR_TIPOS)[number]["key"];

/** Cargan y corrigen lugares quienes cargan datos sociales (no Auditoría ni el relevador). */
export function canEditLugares(role?: Role | string | null): boolean {
  return canEditSocialRecords(role) && !isEmergencySurveyor(role);
}

/** Borra un lugar quien lo cargó, o la conducción. */
export function canDeleteLugar(user: { id?: string | null; role?: Role | string | null }, createdById: string | null): boolean {
  if (!canEditLugares(user.role)) return false;
  return MANAGEMENT_ROLES.includes(user.role as Role) || (Boolean(user.id) && user.id === createdById);
}

export const lugarTipoLabel = (key: string) => LUGAR_TIPOS.find((t) => t.key === key)?.label ?? "Otro";

export type LugarInput = {
  tipo: LugarTipo;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  contacto: string | null;
  horario: string | null;
  notas: string | null;
};

const LIMITS = { nombre: 120, direccion: 160, telefono: 60, contacto: 120, horario: 120, notas: 1000 } as const;

const clean = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s ? s.slice(0, max) : null;
};

/** Revisa lo que se escribió en el formulario. Devuelve los datos limpios o el error para mostrar. */
export function parseLugarInput(raw: Record<string, unknown>): { ok: true; data: LugarInput } | { ok: false; error: string } {
  const tipo = LUGAR_TIPOS.find((t) => t.key === raw.tipo)?.key;
  if (!tipo) return { ok: false, error: "Elegí qué tipo de lugar es." };
  const nombre = clean(raw.nombre, LIMITS.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre del lugar." };
  const notas = typeof raw.notas === "string" ? raw.notas.trim().slice(0, LIMITS.notas) || null : null;
  return {
    ok: true,
    data: {
      tipo,
      nombre,
      direccion: clean(raw.direccion, LIMITS.direccion),
      telefono: clean(raw.telefono, LIMITS.telefono),
      contacto: clean(raw.contacto, LIMITS.contacto),
      horario: clean(raw.horario, LIMITS.horario),
      notas,
    },
  };
}
