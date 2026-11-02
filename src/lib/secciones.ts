import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, ShieldAlert, ClipboardList, Briefcase, Car, UserCog, CheckCircle2, MapPin, Wallet,
  Building2, FileSpreadsheet, Calendar, Sparkles, CloudRain, Settings, Tv, Network, BarChart3, Package,
  ScrollText, MapPinned, GraduationCap, Landmark, Baby, Home, HeartHandshake, KeyRound,
} from "lucide-react";

/**
 * Colores de cada sección del menú. Cada sección tiene uno solo, y el mismo color
 * se usa en el ícono del encabezado de sus pantallas.
 * Las secciones usan los colores institucionales de Tres de Febrero (azules y naranja);
 * las áreas sociales conservan su propio color.
 * Las clases van escritas enteras para que Tailwind las encuentre.
 */
export type SectionTone =
  // Institucionales, para las secciones
  | "navy" | "azul" | "celeste" | "naranja" | "ocre" | "pizarra"
  // Propios de las áreas
  | "blue" | "emerald" | "amber" | "rose";

export const SECTION_TONE_CLASSES: Record<SectionTone, { chip: string; dot: string; icon: string }> = {
  navy: {
    chip: "bg-muni-blue/10 text-muni-blue dark:bg-muni-softblue/15 dark:text-muni-softblue",
    dot: "bg-muni-blue dark:bg-muni-softblue",
    icon: "text-muni-blue dark:text-muni-softblue",
  },
  azul: {
    chip: "bg-muni-midblue/10 text-muni-midblue dark:bg-muni-lightsky/15 dark:text-muni-lightsky",
    dot: "bg-muni-midblue dark:bg-muni-lightsky",
    icon: "text-muni-midblue dark:text-muni-lightsky",
  },
  celeste: {
    chip: "bg-muni-sky/10 text-muni-sky dark:bg-muni-sky/20 dark:text-muni-lightsky",
    dot: "bg-muni-sky",
    icon: "text-muni-sky dark:text-muni-lightsky",
  },
  naranja: {
    chip: "bg-muni-orange/15 text-muni-ochre dark:bg-muni-orange/15 dark:text-muni-orange",
    dot: "bg-muni-orange",
    icon: "text-muni-ochre dark:text-muni-orange",
  },
  ocre: {
    chip: "bg-muni-ochre/10 text-muni-ochre dark:bg-muni-softorange/15 dark:text-muni-softorange",
    dot: "bg-muni-ochre dark:bg-muni-softorange",
    icon: "text-muni-ochre dark:text-muni-softorange",
  },
  pizarra: {
    chip: "bg-muni-body/10 text-muni-body dark:bg-slate-400/15 dark:text-slate-300",
    dot: "bg-muni-body dark:bg-slate-400",
    icon: "text-muni-body dark:text-slate-300",
  },
  blue: {
    chip: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300",
    dot: "bg-blue-500",
    icon: "text-blue-600 dark:text-blue-300",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    icon: "text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    chip: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    dot: "bg-amber-500",
    icon: "text-amber-700 dark:text-amber-300",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
    dot: "bg-rose-500",
    icon: "text-rose-600 dark:text-rose-300",
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
    tone: "navy",
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
    tone: "naranja",
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
    tone: "azul",
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
    tone: "celeste",
    collapsible: true,
    items: [{ title: "Convenios", url: "/admin/agreements", icon: Landmark }],
  },
  {
    id: "recursos",
    title: "Recursos",
    tone: "ocre",
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
    tone: "pizarra",
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
    tone: "navy",
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
  { prefix: "/convenios", tone: "celeste" },
];

export function isNavItemActive(pathname: string, url: string) {
  return pathname === url || (url !== "/dashboard" && pathname.startsWith(`${url}/`));
}

/** Color de la sección a la que pertenece una pantalla (azul institucional si no es de ninguna). */
export function sectionToneForPath(pathname: string): SectionTone {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => isNavItemActive(pathname, i.url));
    if (item) return item.tone ?? group.tone;
  }
  return EXTRA_PATHS.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`))?.tone ?? "navy";
}
