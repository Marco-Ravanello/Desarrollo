// Unir dos fichas de la misma persona (cargada dos veces, con un DNI provisorio o con un error en el DNI).
// Sin acceso a la base: qué ficha conviene que quede y cómo se cuenta lo que pasa de una a la otra.

import { isProvisionalDni } from "@/lib/case-summary";
import { plural } from "@/lib/formato";

/** Lo que se muestra de cada ficha antes de unirlas, para comparar. */
export type MergeSide = {
  dni: string;
  nombre: string | null;
  enPadron: boolean;
  enRegistro: boolean;
  direccion: string | null;
  telefono: string | null;
  nacimiento: string | null;
  programas: string[];
  expedientes: number;
  intervenciones: number;
  documentos: number;
  cursos: number;
  visitas: number;
  fichasTormenta: number;
  convenios: number;
};

/** Una ficha que aparece al buscar con cuál unir. `sugerida`: tiene el mismo nombre. */
export type MergeCandidate = { dni: string; nombre: string | null; direccion: string | null; sugerida?: boolean };

const weight = (s: MergeSide) => s.expedientes * 3 + s.intervenciones + s.documentos + s.programas.length * 2 + s.cursos + s.visitas + s.convenios;

/**
 * Qué DNI conviene que quede: primero el que no es provisorio ("Sin DNI"), después el que está en el padrón,
 * después el que tiene más cosas cargadas. Si empatan, la ficha desde la que se abrió (`a`).
 */
export function recommendedKeep(a: MergeSide, b: MergeSide): string {
  const provA = isProvisionalDni(a.dni);
  const provB = isProvisionalDni(b.dni);
  if (provA !== provB) return provA ? b.dni : a.dni;
  if (a.enPadron !== b.enPadron) return a.enPadron ? a.dni : b.dni;
  if (weight(a) !== weight(b)) return weight(a) >= weight(b) ? a.dni : b.dni;
  return a.dni;
}

const plainName = (s: string | null) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

/** Si los nombres no tienen ninguna palabra en común, se avisa antes de unir (puede ser otra persona). */
export function namesLookDifferent(a: string | null, b: string | null): boolean {
  const wa = new Set(plainName(a).split(" ").filter((w) => w.length > 2));
  const wb = plainName(b).split(" ").filter((w) => w.length > 2);
  if (!wa.size || !wb.length) return false;
  return !wb.some((w) => wa.has(w));
}

/** Lo que pasa de la ficha que se borra a la que queda, en palabras ("2 expedientes, 5 intervenciones"). */
export function movedSummary(s: MergeSide): string {
  const parts = [
    s.expedientes && plural(s.expedientes, "expediente"),
    s.intervenciones && plural(s.intervenciones, "intervención", "intervenciones"),
    s.documentos && plural(s.documentos, "documento"),
    s.programas.length && plural(s.programas.length, "programa"),
    s.cursos && plural(s.cursos, "curso"),
    s.visitas && plural(s.visitas, "visita de recorrida", "visitas de recorrida"),
    s.fichasTormenta && plural(s.fichasTormenta, "ficha de tormenta", "fichas de tormenta"),
    s.convenios && plural(s.convenios, "registro de convenio", "registros de convenio"),
  ].filter(Boolean) as string[];
  if (!parts.length) return "nada más que sus datos";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/** El detalle que queda en la auditoría al unir, para encontrar de dónde vino una ficha borrada. */
export const mergedAuditPrefix = (removeDni: string) => `Se unió el DNI ${removeDni} en el DNI `;

/** Del detalle de la auditoría, a qué DNI fue a parar una ficha unida. */
export function mergedInto(details: string | null | undefined, removeDni: string): string | null {
  const prefix = mergedAuditPrefix(removeDni);
  if (!details?.startsWith(prefix)) return null;
  const m = details.slice(prefix.length).match(/^([A-Za-z0-9-]+)/);
  return m ? m[1].replace(/\.$/, "") : null;
}
