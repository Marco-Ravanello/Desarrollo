// Altas y bajas de varias personas juntas. Sin base de datos, para poder probarlo solo.

/** Cuántas personas se pueden dar de alta o de baja de una sola vez. */
export const BULK_MAX = 200;

/**
 * Los DNI de un texto pegado (uno por renglón, separados por comas o como vengan de una planilla).
 * Acepta puntos ("30.123.456"). Devuelve los DNI sin repetir, en el orden en que aparecen, y lo que no
 * parece un DNI.
 */
export function parseDniList(text: string): { dnis: string[]; invalid: string[]; tooMany: boolean } {
  const tokens = (text ?? "")
    .split(/[\s,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const dnis: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const clean = t.replace(/\./g, "");
    if (/^\d{6,9}$/.test(clean)) {
      const dni = clean.replace(/^0+/, "");
      if (!seen.has(dni)) {
        seen.add(dni);
        dnis.push(dni);
      }
    } else invalid.push(t);
  }
  return { dnis: dnis.slice(0, BULK_MAX), invalid: invalid.slice(0, 20), tooMany: dnis.length > BULK_MAX };
}

export type BulkSkipped = { dni: string; nombre: string | null; reason: string };
export type BulkOutcome = { done: number; skipped: BulkSkipped[] };

/** "Se dieron 12 altas. 2 no se pudieron: …" */
export function bulkSummary(kind: "alta" | "baja", outcome: BulkOutcome): string {
  const word = kind === "alta" ? (outcome.done === 1 ? "alta" : "altas") : outcome.done === 1 ? "baja" : "bajas";
  const head = outcome.done === 0 ? `No se dio ninguna ${kind}.` : `Listo: ${outcome.done === 1 ? "se dio 1" : `se dieron ${outcome.done}`} ${word}.`;
  if (!outcome.skipped.length) return head;
  return `${head} ${outcome.skipped.length === 1 ? "1 no se pudo" : `${outcome.skipped.length} no se pudieron`}.`;
}
