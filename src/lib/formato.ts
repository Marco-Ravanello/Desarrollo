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

/** Importe con centavos solo cuando los tiene (precios unitarios): 1500 → "$ 1.500"; 12.5 → "$ 12,50". */
export function formatPesosExactos(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `$ ${formatNumber(v, Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2)}`;
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

/** Valores guardados en mayúsculas ("MEDIA", "EN_PROCESO") como texto normal: "Media", "En proceso". */
export function textoNormal(value: string | null | undefined): string {
  const s = (value ?? "").replace(/_/g, " ").trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Importe corto para tarjetas angostas: 200000 → "$ 200 mil"; 1234567 → "$ 1,2 M"; 2500000000 → "$ 2.500 M". */
export function formatPesosCorto(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$ ${formatNumber(v / 1_000_000, abs >= 100_000_000 || v % 1_000_000 === 0 ? 0 : 1)} M`;
  if (abs >= 1_000) return `$ ${formatNumber(Math.round(v / 1_000))} mil`;
  return formatPesos(v);
}
