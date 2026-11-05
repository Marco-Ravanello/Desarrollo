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

/**
 * Colores con sentido para los gráficos, los mismos que las insignias de estado (lib/status-tones.ts):
 * rojo = urgente o fuera de servicio, naranja = alta o en el taller, verde = disponible, etc.
 */
const TONE_HEX: Record<string, [light: string, dark: string]> = {
  red: ["#E11D48", "#FB7185"],
  orange: ["#EA580C", "#FB923C"],
  amber: ["#D97706", "#FBBF24"],
  blue: ["#2563EB", "#60A5FA"],
  green: ["#059669", "#34D399"],
  violet: ["#7C3AED", "#A78BFA"],
  slate: ["#64748B", "#94A3B8"],
};

/** El color de un tono de estado ("red", "green"…); null si no es uno conocido. */
export function toneColor(tone: string | undefined | null, dark: boolean): string | null {
  const hex = tone ? TONE_HEX[tone] : undefined;
  return hex ? hex[dark ? 1 : 0] : null;
}
