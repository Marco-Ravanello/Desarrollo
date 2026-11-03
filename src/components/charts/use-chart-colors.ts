"use client";

import { useTheme } from "next-themes";
import { chartPalette, type ChartPalette } from "@/lib/chart-colors";

/** Colores de los gráficos para el modo actual (claro u oscuro, también si sigue al de la compu). */
export function useChartColors(): ChartPalette {
  const { resolvedTheme } = useTheme();
  return chartPalette(resolvedTheme === "dark");
}
