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
