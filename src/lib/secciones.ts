import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, ShieldAlert, ClipboardList, Briefcase, Car, UserCog, CheckCircle2, MapPin, Wallet,
  Building2, FileSpreadsheet, Calendar, Sparkles, CloudRain, Settings, Tv, Network, BarChart3, Package,
  ScrollText, MapPinned, GraduationCap, Landmark, Baby, Home, HeartHandshake, KeyRound,
} from "lucide-react";

/**
 * Colores de cada sección del menú. Cada sección tiene uno solo, y el mismo color
 * se usa en el ícono del encabezado de sus pantallas.
 * Las clases van escritas enteras para que Tailwind las encuentre.
 */
export type SectionTone = "blue" | "violet" | "emerald" | "cyan" | "orange" | "slate" | "amber" | "rose";

export const SECTION_TONE_CLASSES: Record<SectionTone, { chip: string; chipActive: string; dot: string }> = {
  blue: {
    chip: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300",
    chipActive: "bg-blue-600 text-white dark:bg-blue-500",
    dot: "bg-blue-500",
  },
  violet: {
    chip: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
    chipActive: "bg-violet-600 text-white dark:bg-violet-500",
    dot: "bg-violet-500",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    chipActive: "bg-emerald-600 text-white dark:bg-emerald-500",
    dot: "bg-emerald-500",
  },
  cyan: {
    chip: "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    chipActive: "bg-cyan-600 text-white dark:bg-cyan-500",
    dot: "bg-cyan-500",
  },
  orange: {
    chip: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
    chipActive: "bg-orange-600 text-white dark:bg-orange-500",
    dot: "bg-orange-500",
  },
  slate: {
    chip: "bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300",
    chipActive: "bg-slate-600 text-white dark:bg-slate-500",
    dot: "bg-slate-500",
  },
  amber: {
    chip: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    chipActive: "bg-amber-600 text-white dark:bg-amber-500",
    dot: "bg-amber-500",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
    chipActive: "bg-rose-600 text-white dark:bg-rose-500",
    dot: "bg-rose-500",
  },
};

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Solo para las áreas: cada una conserva su propio color. */
  tone?: SectionTone;
}

export interface NavGroup {
  id: string;
  title: string;
  tone: SectionTone;
  items: NavItem[];
  /** Los grupos de Administración se pueden plegar. */
  collapsible?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "principal",
    title: "Principal",
    tone: "blue",
    items: [
      { title: "Inicio", url: "/dashboard", icon: LayoutDashboard },
      { title: "Ficha Social 360°", url: "/ficha-social", icon: Network },
      { title: "Expedientes", url: "/cases", icon: ClipboardList },
      { title: "Mapa Social", url: "/maps", icon: MapPin },
      { title: "Barrios", url: "/barrios", icon: MapPinned },
      { title: "Mis tareas", url: "/tasks", icon: CheckCircle2 },
      { title: "Registro Único", url: "/people", icon: Users },
      { title: "Cursos y talleres", url: "/cursos", icon: GraduationCap },
    ],
  },
  {
    id: "operacion",
    title: "Operación diaria",
    tone: "violet",
    collapsible: true,
    items: [
      { title: "Sala de Situación", url: "/admin/war-room", icon: Tv },
      { title: "Agenda", url: "/admin/calendar", icon: Calendar },
      { title: "Asistente de IA", url: "/admin/assistant", icon: Sparkles },
      { title: "Emergencia climática", url: "/admin/emergency", icon: CloudRain },
    ],
  },
  {
    id: "compras",
    title: "Compras y presupuesto",
    tone: "emerald",
    collapsible: true,
    items: [
      { title: "Órdenes de compra", url: "/admin/purchase-orders", icon: Briefcase },
      { title: "Proveedores", url: "/admin/providers", icon: Building2 },
      { title: "Presupuesto", url: "/admin/budget", icon: Wallet },
      { title: "Reportes", url: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    id: "convenios",
    title: "Convenios",
    tone: "cyan",
    collapsible: true,
    items: [{ title: "Convenios", url: "/admin/agreements", icon: Landmark }],
  },
  {
    id: "recursos",
    title: "Recursos",
    tone: "orange",
    collapsible: true,
    items: [
      { title: "Vehículos", url: "/admin/vehicles", icon: Car },
      { title: "Stock de insumos", url: "/admin/stock", icon: Package },
      { title: "Recursos Humanos", url: "/admin/hr", icon: UserCog },
    ],
  },
  {
    id: "sistema",
    title: "Sistema",
    tone: "slate",
    collapsible: true,
    items: [
      { title: "Configuración", url: "/admin/settings", icon: Settings },
      { title: "Importar datos", url: "/admin/interventions", icon: FileSpreadsheet },
      { title: "Usuarios", url: "/admin/users", icon: KeyRound },
      { title: "Auditoría", url: "/admin/audit", icon: ScrollText },
    ],
  },
  {
    id: "areas",
    title: "Áreas sociales",
    tone: "blue",
    items: [
      { title: "Protección Social", url: "/areas/social", icon: HeartHandshake, tone: "emerald" },
      { title: "Niñez y Familia", url: "/areas/ninez", icon: Baby, tone: "amber" },
      { title: "Hábitat y Vivienda", url: "/areas/habitat", icon: Home, tone: "blue" },
      { title: "Violencia de Género", url: "/areas/violence", icon: ShieldAlert, tone: "rose" },
    ],
  },
];

/** Otras pantallas que no están en el menú pero pertenecen a una sección. */
const EXTRA_PATHS: { prefix: string; tone: SectionTone }[] = [
  { prefix: "/convenios", tone: "cyan" },
];

export function isNavItemActive(pathname: string, url: string) {
  return pathname === url || (url !== "/dashboard" && pathname.startsWith(`${url}/`));
}

/** Color de la sección a la que pertenece una pantalla (azul si no es de ninguna). */
export function sectionToneForPath(pathname: string): SectionTone {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => isNavItemActive(pathname, i.url));
    if (item) return item.tone ?? group.tone;
  }
  return EXTRA_PATHS.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`))?.tone ?? "blue";
}
