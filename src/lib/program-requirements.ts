// Requisitos simples de cada programa del padrón (edad, barrio, etiquetas de expedientes y otros
// programas) y cómo se leen en pantalla. Sin acceso a la base: se usa en pantalla y en el servidor.
import { BARRIOS_3F, type Barrio3F } from "@/lib/barrios";
import { caseLabelName, normalizeCaseLabels, type CaseLabelKey } from "@/lib/case-labels";
import { PADRON_PROGRAMS, findPadronProgram, isPadronProgramColumn, type PadronProgramColumn } from "@/lib/padron-programs";

export const REQUIREMENT_NOTE_MAX = 500;
export const REQUIREMENT_AGE_MAX = 110;

export type ProgramRequirements = {
  edadMin: number | null;
  edadMax: number | null;
  barrios: Barrio3F[];
  etiquetas: CaseLabelKey[];
  /** Que esté en alguno de estos programas. */
  enProgramas: PadronProgramColumn[];
  /** Que no esté en ninguno de estos programas. */
  sinProgramas: PadronProgramColumn[];
  nota: string | null;
};

export const EMPTY_REQUIREMENTS: ProgramRequirements = {
  edadMin: null, edadMax: null, barrios: [], etiquetas: [], enProgramas: [], sinProgramas: [], nota: null,
};

/** ¿Tiene algún requisito que la app pueda revisar? (la nota sola no alcanza para armar la lista). */
export function hasCheckableRequirements(r: ProgramRequirements): boolean {
  return r.edadMin !== null || r.edadMax !== null || r.barrios.length > 0 || r.etiquetas.length > 0 || r.enProgramas.length > 0 || r.sinProgramas.length > 0;
}

function ageValue(raw: unknown): number | null | "invalid" {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 0 || n > REQUIREMENT_AGE_MAX) return "invalid";
  return n;
}

const list = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);

/**
 * Revisa lo que llega del formulario. El programa mismo no puede ser requisito ni exclusión,
 * y un programa no puede estar en las dos listas a la vez.
 */
export function parseRequirementsInput(
  column: PadronProgramColumn,
  raw: Record<string, unknown>
): { ok: true; data: ProgramRequirements } | { ok: false; error: string } {
  const edadMin = ageValue(raw.edadMin);
  const edadMax = ageValue(raw.edadMax);
  if (edadMin === "invalid" || edadMax === "invalid") return { ok: false, error: `La edad tiene que ser un número entero entre 0 y ${REQUIREMENT_AGE_MAX}.` };
  if (edadMin !== null && edadMax !== null && edadMin > edadMax) return { ok: false, error: "La edad mínima no puede ser mayor que la máxima." };

  const wantedBarrios = new Set(list(raw.barrios));
  const barrios = BARRIOS_3F.filter((b) => wantedBarrios.has(b));
  const etiquetas = normalizeCaseLabels(raw.etiquetas);
  const pick = (values: unknown) => {
    const wanted = new Set(list(values).filter((c) => isPadronProgramColumn(c) && c !== column));
    return PADRON_PROGRAMS.map((p) => p.column).filter((c) => wanted.has(c));
  };
  const enProgramas = pick(raw.enProgramas);
  const sinProgramas = pick(raw.sinProgramas);
  const both = enProgramas.find((c) => sinProgramas.includes(c));
  if (both) return { ok: false, error: `${findPadronProgram(both)!.label} no puede ser requisito y exclusión a la vez.` };
  const nota = typeof raw.nota === "string" ? raw.nota.trim().slice(0, REQUIREMENT_NOTE_MAX) || null : null;

  return { ok: true, data: { edadMin, edadMax, barrios, etiquetas, enProgramas, sinProgramas, nota } };
}

/** Lo que viene de la base, limpio (por si cambió la lista de barrios, etiquetas o programas). */
export function requirementsFromRow(
  column: PadronProgramColumn,
  row: { edadMin: number | null; edadMax: number | null; barrios: string[]; etiquetas: string[]; enProgramas: string[]; sinProgramas: string[]; nota: string | null } | null
): ProgramRequirements {
  if (!row) return EMPTY_REQUIREMENTS;
  const parsed = parseRequirementsInput(column, row);
  return parsed.ok ? parsed.data : { ...EMPTY_REQUIREMENTS, nota: row.nota };
}

function joinList(items: string[], word = "o"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`;
}

/** "De 18 a 25 años", "Desde 60 años", "Hasta 4 años". */
export function ageText(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return min === max ? `${min} ${min === 1 ? "año" : "años"}` : `De ${min} a ${max} años`;
  if (min !== null) return `Desde ${min} ${min === 1 ? "año" : "años"}`;
  if (max !== null) return `Hasta ${max} ${max === 1 ? "año" : "años"}`;
  return null;
}

/** Cada requisito como una frase corta, para mostrar en la página del programa. */
export function describeRequirements(r: ProgramRequirements): string[] {
  const label = (c: string) => findPadronProgram(c)?.label ?? c;
  return [
    ageText(r.edadMin, r.edadMax),
    r.barrios.length ? `Vive en ${joinList(r.barrios)}` : null,
    r.etiquetas.length ? `Tiene un expediente abierto de ${joinList(r.etiquetas.map((k) => (caseLabelName(k) ?? k).toLowerCase()))}` : null,
    r.enProgramas.length ? `Está en ${joinList(r.enProgramas.map(label))}` : null,
    r.sinProgramas.length ? `No está en ${joinList(r.sinProgramas.map(label), "ni")}` : null,
  ].filter((x): x is string => Boolean(x));
}

/** Para Auditoría: los requisitos en una línea. */
export function requirementsSummary(r: ProgramRequirements): string {
  const parts = describeRequirements(r);
  if (r.nota) parts.push(`Otros: ${r.nota}`);
  return parts.length ? parts.join(". ") + "." : "Sin requisitos.";
}
