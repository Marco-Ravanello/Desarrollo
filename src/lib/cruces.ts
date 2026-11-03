// Cruces de programas: los tres modos, cómo se arma la condición sobre el padrón y la frase que lo explica.
// Sin base de datos, para poder probarlo solo.
import { PADRON_PROGRAMS } from "@/lib/padron-programs";

export type ModoCruce = "interseccion" | "union" | "diferencia";

export interface ModoCruceInfo {
  id: ModoCruce;
  nombre: string;
  descripcion: string;
}

export const MODOS_CRUCE: ModoCruceInfo[] = [
  { id: "interseccion", nombre: "Coincidencia", descripcion: "Personas que están en todos los programas elegidos a la vez." },
  { id: "union", nombre: "Cobertura", descripcion: "Personas que están en al menos uno de los programas elegidos." },
  { id: "diferencia", nombre: "Exclusión", descripcion: "Personas que están en el programa base y en ninguno de los demás elegidos." },
];

export function parseModoCruce(value: unknown): ModoCruce {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return v === "union" || v === "diferencia" ? v : "interseccion";
}

export function nombreDelModo(modo: ModoCruce): string {
  return MODOS_CRUCE.find((m) => m.id === modo)?.nombre ?? "Coincidencia";
}

const LABEL_TO_COLUMN: Record<string, string> = Object.fromEntries(PADRON_PROGRAMS.map((p) => [p.label, p.column]));
const COLUMNS = new Set<string>(PADRON_PROGRAMS.map((p) => p.column));

/** Columnas del padrón de los programas pedidos (por nombre o por columna), en el mismo orden y sin repetir. */
export function columnasDelCruce(programas: string[]): string[] {
  const out: string[] = [];
  for (const p of programas) {
    const col = LABEL_TO_COLUMN[p.trim()] ?? (COLUMNS.has(p.trim()) ? p.trim() : null);
    if (col && /^[a-z0-9_]+$/.test(col) && !out.includes(col)) out.push(col);
  }
  return out;
}

/**
 * Condición SQL sobre padron_unificado. Las columnas salen solo de la lista fija de programas.
 * En "Exclusión" la primera columna es el programa base.
 */
export function condicionDelCruce(columnas: string[], modo: ModoCruce): string {
  if (columnas.length === 0) return "1=1";
  const esta = (c: string) => `"${c}" = 1`;
  if (modo === "union") return `(${columnas.map(esta).join(" OR ")})`;
  if (modo === "diferencia") {
    const [base, ...resto] = columnas;
    if (resto.length === 0) return `(${esta(base)})`;
    return `(${esta(base)} AND NOT (${resto.map((c) => `COALESCE("${c}", 0) = 1`).join(" OR ")}))`;
  }
  return `(${columnas.map(esta).join(" AND ")})`;
}

function lista(nombres: string[], ultimo: "y" | "o"): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} ${ultimo} ${nombres[nombres.length - 1]}`;
}

/** La frase que acompaña al número: "en Tarjeta Alimentar y Jardines Municipales a la vez". */
export function fraseDelCruce(programas: string[], modo: ModoCruce): string {
  if (programas.length === 0) return "";
  if (modo === "union") return programas.length === 1 ? `en ${programas[0]}` : `en ${lista(programas, "o")}`;
  if (modo === "diferencia") {
    const [base, ...resto] = programas;
    if (resto.length === 0) return `en ${base}`;
    return resto.length === 1 ? `en ${base} y no en ${resto[0]}` : `en ${base} y en ninguno de estos: ${lista(resto, "y")}`;
  }
  return programas.length === 1 ? `en ${programas[0]}` : `en ${lista(programas, "y")} a la vez`;
}

/** Las columnas de todos los programas, para pedirlas en el SELECT (salen de la lista fija). */
export const COLUMNAS_DE_PROGRAMAS_SQL = PADRON_PROGRAMS.map((p) => `"${p.column}"`).join(", ");

/** Los programas de una fila del padrón con sus nombres, según las columnas prog_ (las mismas que usa el cruce). */
export function programasDeLaFila(fila: Record<string, unknown>): string[] {
  return PADRON_PROGRAMS.filter((p) => Number(fila[p.column] ?? 0) === 1).map((p) => p.label);
}
