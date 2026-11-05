import { chartPalette, toneColor } from "@/lib/chart-colors";
import { formatNumber } from "@/lib/formato";

// Cómo se dibujan los gráficos del asistente. Sin acceso a la base: se usa en pantalla y en las pruebas.

export type AssistantChartPoint = { name: string; value: number; tone?: string };
export type AssistantChartData = {
  type?: string;
  title?: string;
  /** "pesos" muestra los valores como plata. */
  format?: "pesos";
  /** Títulos de las dos columnas de la planilla: qué es cada fila y qué se cuenta. */
  columns?: string[];
  data?: AssistantChartPoint[];
};

/** Un número del gráfico, como se escribe en Argentina ("1.234" o "$ 1.234"). */
export function formatChartValue(value: number, format?: string): string {
  return format === "pesos" ? `$ ${formatNumber(value)}` : formatNumber(value);
}

/**
 * Los colores de cada barra o porción. Si los datos traen un tono (prioridad, estado), se usa ese color.
 * Las barras sin tono van todas en azul (es una sola cosa contada); las tortas usan la paleta para separar.
 */
export function chartColors(chart: AssistantChartData, dark: boolean): string[] {
  const data = chart.data ?? [];
  const palette = chartPalette(dark);
  const withTone = data.some((d) => toneColor(d.tone, dark));
  return data.map((d, i) => {
    if (withTone) return toneColor(d.tone, dark) ?? palette[palette.length - 1];
    return chart.type === "pie" ? palette[i % palette.length] : palette[0];
  });
}

/** Barras acostadas cuando hay muchas o los nombres son largos, así se leen enteros. */
export function horizontalBars(data: AssistantChartPoint[]): boolean {
  return data.length > 6 || data.some((d) => d.name.length > 14);
}

/** Qué parte del total es cada porción de la torta ("35 %"). */
export function share(value: number, total: number): string {
  if (!total) return "0 %";
  const pct = (value / total) * 100;
  return `${pct < 1 && pct > 0 ? "menos de 1" : Math.round(pct)} %`;
}

/** Las filas de la planilla de Excel: una por barra o porción, con los títulos de las columnas. */
export function chartSheetRows(chart: AssistantChartData): Record<string, string | number>[] {
  const [nameCol, valueCol] = [chart.columns?.[0] || "Categoría", chart.columns?.[1] || (chart.format === "pesos" ? "Monto" : "Cantidad")];
  return (chart.data ?? []).map((d) => ({ [nameCol]: d.name, [valueCol]: d.value }));
}

/** Nombre del archivo: el título sin signos raros, con la fecha. */
export function chartFileName(title: string, now = new Date()): string {
  const base =
    (title || "grafico")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "grafico";
  return `${base}-${now.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })}.xlsx`;
}
