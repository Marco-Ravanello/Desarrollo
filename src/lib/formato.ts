// Números y plurales escritos como en Argentina: "1.200", "0,5 %", "1 programa activo".

/** Número con punto de miles: 1200 → "1.200". */
export function formatNumber(n: number | null | undefined, decimals = 0): string {
  return Number(n ?? 0).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Porcentaje con coma decimal y espacio: 12.5 → "12,5 %". */
export function formatPercent(n: number | null | undefined, decimals = 1): string {
  return `${formatNumber(Number.isFinite(Number(n)) ? Number(n) : 0, decimals)} %`;
}

/** Importe en pesos sin decimales: 1500 → "$ 1.500". */
export function formatPesos(n: number | null | undefined): string {
  return `$ ${formatNumber(n)}`;
}

/** Cantidad con la palabra en singular o plural: (1, "registro") → "1 registro"; (3, "registro") → "3 registros". */
export function plural(n: number | null | undefined, singular: string, pluralForm?: string): string {
  const count = Number(n ?? 0);
  const word = count === 1 ? singular : pluralForm ?? defaultPlural(singular);
  return `${formatNumber(count)} ${word}`;
}

function defaultPlural(word: string): string {
  // Frases ("programa activo"): se pluraliza cada palabra.
  if (word.includes(" ")) return word.split(" ").map(defaultPlural).join(" ");
  if (/[aeiouáéó]$/i.test(word)) return `${word}s`;
  if (/z$/i.test(word)) return `${word.slice(0, -1)}ces`;
  // "acción" → "acciones", "camión" → "camiones": se va la tilde.
  if (/ón$/i.test(word)) return `${word.slice(0, -2)}ones`;
  return `${word}es`;
}
