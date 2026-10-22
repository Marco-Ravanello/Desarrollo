export const AREA_COLORS: Record<string, string> = {
  emerald: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
  amber: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20",
  blue: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20",
  rose: "border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/20",
  slate: "border-slate-500 text-slate-600 bg-slate-50 dark:bg-slate-950/20",
  violet: "border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-950/20",
};

export const AREA_NAV_COLORS: Record<string, string> = {
  emerald: "text-emerald-400 group-hover:text-emerald-300",
  amber: "text-amber-400 group-hover:text-amber-300",
  blue: "text-blue-400 group-hover:text-blue-300",
  rose: "text-rose-400 group-hover:text-rose-300",
  slate: "text-slate-400 group-hover:text-slate-300",
  violet: "text-violet-400 group-hover:text-violet-300",
};

export const AREA_BG_COLORS: Record<string, string> = {
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  blue: "bg-blue-600",
  rose: "bg-rose-600",
  slate: "bg-slate-600",
  violet: "bg-violet-600",
};

export function getAreaColor(colorName?: string | null) {
  return AREA_COLORS[colorName || "blue"] || AREA_COLORS.blue;
}

export function getAreaNavColor(colorName?: string | null) {
  return AREA_NAV_COLORS[colorName || "blue"] || AREA_NAV_COLORS.blue;
}

export function getAreaBgColor(colorName?: string | null) {
  return AREA_BG_COLORS[colorName || "blue"] || AREA_BG_COLORS.blue;
}

/** Áreas que no tienen página propia en "Áreas" (su lista es la de Expedientes filtrada). */
function isAreaWithoutPage(name: string) {
  return name.includes("general") || name.includes("formación") || name.includes("formacion");
}

/**
 * Página del área. La Dirección General y el Centro de Formación no tienen página propia:
 * con su id se va a Expedientes filtrado por esa área.
 */
export function getAreaDashboardUrl(areaName?: string, areaId?: string): string {
  if (!areaName) return "/areas/social";
  const name = areaName.toLowerCase();
  if (isAreaWithoutPage(name)) return areaId ? `/cases?area=${encodeURIComponent(areaId)}` : "/cases";
  if (name.includes("violencia") || name.includes("género") || name.includes("genero")) return "/areas/violence";
  if (name.includes("niñez") || name.includes("ninez") || name.includes("familia")) return "/areas/ninez";
  if (name.includes("hábitat") || name.includes("habitat") || name.includes("vivienda")) return "/areas/habitat";
  return "/areas/social";
}

/** Nombre corto del área para listas y encabezados. */
export function getAreaShortName(areaName?: string): string {
  if (!areaName) return "Sin área";
  const name = areaName.toLowerCase();
  // Primero las que se confundían: "Dirección General de Desarrollo Humano y Hábitat" dice "Hábitat",
  // y la de Violencia dice "Protección".
  if (name.includes("general")) return "Dirección General";
  if (name.includes("formación") || name.includes("formacion")) return "Centro de Formación";
  if (name.includes("violencia") || name.includes("género") || name.includes("genero")) return "Violencia de Género";
  if (name.includes("niñez") || name.includes("ninez") || name.includes("familia")) return "Niñez y Familia";
  if (name.includes("hábitat") || name.includes("habitat") || name.includes("vivienda")) return "Hábitat y Vivienda";
  if (name.includes("protección social") || name.includes("proteccion social")) return "Protección Social";
  // Un área nueva: su nombre sin "Dirección de" / "Coordinación de".
  return areaName.replace(/^(direcci[oó]n|coordinaci[oó]n)\s+(de\s+(la\s+|los\s+|las\s+)?)?/i, "").trim() || areaName;
}

/**
 * Elige el área de una página de "Áreas". Las palabras van de la más precisa a la más general:
 * gana el área que tiene la primera palabra de la lista, y entre varias, la que no es la Dirección General
 * (que tiene "Desarrollo" y "Hábitat" en el nombre y antes se quedaba con dos páginas ajenas).
 */
export function pickAreaByKeywords<T extends { name: string }>(areas: T[], keywords: string[]): T | null {
  for (const keyword of keywords) {
    const k = keyword.toLowerCase();
    const matches = areas.filter((a) => a.name.toLowerCase().includes(k));
    if (matches.length === 0) continue;
    return matches.find((a) => !a.name.toLowerCase().includes("general")) ?? matches[0];
  }
  return null;
}
