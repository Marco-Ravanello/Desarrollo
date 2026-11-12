// Comparar barrios (idea 42) y pintar el mapa según una etiqueta (idea 43). Sin base de datos, para poder probarlo solo.
// "Habitantes" son las personas del padrón de cada barrio: no tenemos el censo.

export type ComparisonInput = {
  barrio: string;
  slug: string;
  people: number;
  withPrograms: number;
  openCases: number;
  sinTelefono: number;
  sinAltura: number;
  sinUbicacion: number;
  /** Expedientes sin cerrar por etiqueta (clave de lib/case-labels.ts). */
  labels: Record<string, number>;
};

export type ComparisonRow = ComparisonInput & {
  /** Expedientes abiertos cada 1.000 personas del padrón; null si el barrio no tiene personas. */
  casesPer1000: number | null;
  /** Porcentaje de las personas con algún programa. */
  coverage: number | null;
  faltaTelefono: number | null;
  faltaAltura: number | null;
  faltaUbicacion: number | null;
};

/** Con menos personas que esto, los porcentajes de un barrio dicen poco: no entra en "dónde mirar primero". */
export const MIN_PEOPLE_TO_COMPARE = 50;

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

export function per1000(n: number, people: number): number | null {
  if (!people) return null;
  return oneDecimal((n / people) * 1000);
}

export function percent(n: number, people: number): number | null {
  if (!people) return null;
  return oneDecimal((n / people) * 100);
}

export function comparisonRows(input: ComparisonInput[]): ComparisonRow[] {
  return input.map((b) => ({
    ...b,
    casesPer1000: per1000(b.openCases, b.people),
    coverage: percent(b.withPrograms, b.people),
    faltaTelefono: percent(b.sinTelefono, b.people),
    faltaAltura: percent(b.sinAltura, b.people),
    faltaUbicacion: percent(b.sinUbicacion, b.people),
  }));
}

export const COMPARE_SORTS = {
  barrio: { label: "Barrio", value: null, desc: false },
  personas: { label: "Personas del padrón", value: (r: ComparisonRow) => r.people, desc: true },
  expedientes: { label: "Expedientes cada 1.000", value: (r: ComparisonRow) => r.casesPer1000, desc: true },
  cobertura: { label: "Con algún programa", value: (r: ComparisonRow) => r.coverage, desc: false },
  telefono: { label: "Sin teléfono", value: (r: ComparisonRow) => r.faltaTelefono, desc: true },
  altura: { label: "Sin altura", value: (r: ComparisonRow) => r.faltaAltura, desc: true },
  ubicacion: { label: "Sin ubicar", value: (r: ComparisonRow) => r.faltaUbicacion, desc: true },
} as const;

export type CompareSort = keyof typeof COMPARE_SORTS;

export const isCompareSort = (v: unknown): v is CompareSort => typeof v === "string" && Object.prototype.hasOwnProperty.call(COMPARE_SORTS, v);

/**
 * Ordena por la columna elegida: los números más altos primero, salvo "Con algún programa", que va de menos a más
 * (arriba, los barrios con menos cobertura). Los barrios sin personas van siempre al final; entre iguales, por nombre.
 */
export function sortComparison(rows: ComparisonRow[], sort: CompareSort): ComparisonRow[] {
  const byName = (a: ComparisonRow, b: ComparisonRow) => a.barrio.localeCompare(b.barrio, "es");
  const spec = COMPARE_SORTS[sort];
  if (!spec.value) return [...rows].sort(byName);
  const value = spec.value;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? byName(a, b) : va === null ? 1 : -1;
    return (spec.desc ? vb - va : va - vb) || byName(a, b);
  });
}

/** El valor en la posición q (0 a 1) de una lista ordenada. */
function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/**
 * Dónde mirar primero: barrios con muchos expedientes abiertos por persona (el tercio de arriba) y poca cobertura
 * de programas (el tercio de abajo), entre los que tienen al menos MIN_PEOPLE_TO_COMPARE personas.
 */
export function highDemandLowCoverage(rows: ComparisonRow[]): ComparisonRow[] {
  const usable = rows.filter((r) => r.people >= MIN_PEOPLE_TO_COMPARE && r.casesPer1000 !== null && r.coverage !== null);
  if (usable.length < 3) return [];
  const demand = usable.map((r) => r.casesPer1000!).sort((a, b) => a - b);
  const coverage = usable.map((r) => r.coverage!).sort((a, b) => a - b);
  const highDemand = quantile(demand, 2 / 3);
  const lowCoverage = quantile(coverage, 1 / 3);
  return usable
    .filter((r) => r.casesPer1000! > 0 && r.casesPer1000! >= highDemand && r.coverage! <= lowCoverage)
    .sort((a, b) => b.casesPer1000! - a.casesPer1000! || a.coverage! - b.coverage!);
}

/** "12,5" con coma decimal, o una raya si no hay dato. */
export function decimalText(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

/** Suma de los expedientes abiertos por etiqueta de todos los barrios. */
export function labelTotals(perBarrio: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const counts of perBarrio) for (const [k, n] of Object.entries(counts)) out[k] = (out[k] ?? 0) + n;
  return out;
}

/** Las etiquetas que más aparecen (sin las que están en cero), de más a menos; entre iguales, por clave. */
export function topLabels(counts: Record<string, number>, limit: number): { key: string; total: number }[] {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key))
    .slice(0, limit);
}
