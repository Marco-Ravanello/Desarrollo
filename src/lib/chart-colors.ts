// Colores de los gráficos: primero el azul y el naranja de la Municipalidad, y después tonos que
// los acompañan (celeste, verde azulado, violeta y gris pizarra) para que no quede todo igual.
// En modo oscuro el azul institucional casi no se ve sobre el fondo azul, así que va un azul claro
// y los demás tonos un poco más luminosos.
export const CHART_COLORS = ["#163C68", "#F69321", "#4F8FD1", "#2A9D8F", "#8064A2", "#7A8CA3"] as const;
export const CHART_COLORS_DARK = ["#9CC3EC", "#F69321", "#4F8FD1", "#3DB5A6", "#A48FCC", "#A3B1C2"] as const;

export type ChartPalette = readonly string[];

/** La paleta según el modo de la pantalla. */
export function chartPalette(dark: boolean): ChartPalette {
  return dark ? CHART_COLORS_DARK : CHART_COLORS;
}
