// Etiquetas de los expedientes: una lista fija, para que se puedan filtrar y contar sin variantes
// ("adulto mayor", "Adulto Mayor", "AM"). En la base se guarda la clave; en pantalla, el nombre.

export const CASE_LABELS = [
  { key: "ADULTO_MAYOR", label: "Adulto mayor" },
  { key: "DISCAPACIDAD", label: "Discapacidad" },
  { key: "NINEZ", label: "Niñez y adolescencia" },
  { key: "EMBARAZO", label: "Embarazo" },
  { key: "INTERNACION", label: "Internación" },
  { key: "CONSUMO", label: "Consumo problemático" },
  { key: "SITUACION_CALLE", label: "Situación de calle" },
] as const;

export type CaseLabelKey = (typeof CASE_LABELS)[number]["key"];

const BY_KEY = new Map<string, string>(CASE_LABELS.map((l) => [l.key, l.label]));

export function isCaseLabel(key: unknown): key is CaseLabelKey {
  return typeof key === "string" && BY_KEY.has(key);
}

/** El nombre para mostrar; null si la clave no es de la lista. */
export function caseLabelName(key: string): string | null {
  return BY_KEY.get(key) ?? null;
}

/** Solo las claves de la lista, sin repetir y en el orden de la lista. */
export function normalizeCaseLabels(input: unknown): CaseLabelKey[] {
  const wanted = new Set(Array.isArray(input) ? input.filter(isCaseLabel) : []);
  return CASE_LABELS.map((l) => l.key).filter((k) => wanted.has(k));
}

/** Para la historia del expediente: "Agregó: Adulto mayor. Quitó: Internación." (null si no cambió nada). */
export function describeLabelChange(before: string[], after: string[]): string | null {
  const added = after.filter((k) => !before.includes(k)).map((k) => caseLabelName(k) ?? k);
  const removed = before.filter((k) => !after.includes(k)).map((k) => caseLabelName(k) ?? k);
  if (!added.length && !removed.length) return null;
  return [added.length ? `Agregó: ${added.join(", ")}.` : null, removed.length ? `Quitó: ${removed.join(", ")}.` : null]
    .filter(Boolean)
    .join(" ");
}
