// Tarjetas del Inicio y el orden que eligió cada persona ("Ordenar tarjetas").
// Cada persona solo ordena o esconde las tarjetas que ya le corresponden por su rol: no puede sumar otras.
// Sin base de datos, para poder probarlo solo.

export const HOME_SECTION_IDS = [
  "myCases", "attention", "budget", "territorial", "recentCases", "tasks", "vehicles",
  "areas", "team", "quietCases", "followUps", "activity", "away", "programs", "convenioHoras",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

/** El nombre de cada tarjeta, como se lee en el diálogo para ordenarlas. */
export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  myCases: "Mis expedientes a cargo",
  attention: "Requiere atención",
  budget: "Presupuesto",
  territorial: "Actividad territorial (mapa)",
  recentCases: "Expedientes recientes",
  tasks: "Mis próximas tareas",
  vehicles: "Vehículos y logística",
  areas: "Cómo está cada área",
  team: "Equipo del área",
  quietCases: "Sin movimiento",
  followUps: "Seguimientos para hoy",
  activity: "Últimos movimientos",
  away: "De licencia hoy",
  programs: "Programas",
  convenioHoras: "Horas de convenios",
};

export interface HomeLayoutPref {
  /** Orden elegido. Las tarjetas que no figuran quedan después, en su orden de siempre. */
  order: HomeSectionId[];
  /** Tarjetas escondidas. */
  hidden: HomeSectionId[];
}

const isSectionId = (v: unknown): v is HomeSectionId =>
  typeof v === "string" && (HOME_SECTION_IDS as readonly string[]).includes(v);

const cleanList = (v: unknown): HomeSectionId[] =>
  Array.isArray(v) ? [...new Set(v.filter(isSectionId))] : [];

/** Lo guardado en la base (o lo que manda el navegador), revisado. Si no sirve, null (orden de siempre). */
export function parseHomeLayout(raw: unknown): HomeLayoutPref | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const order = cleanList(r.order);
  const hidden = cleanList(r.hidden);
  if (order.length === 0 && hidden.length === 0) return null;
  return { order, hidden };
}

/**
 * Las tarjetas que se muestran, en orden. `available` son las del rol, en su orden de siempre:
 * primero las que la persona ordenó, después las nuevas o no ordenadas, y sin las escondidas.
 */
export function applyHomeLayout(available: readonly HomeSectionId[], pref: HomeLayoutPref | null): HomeSectionId[] {
  if (!pref) return [...available];
  const ordered = pref.order.filter((id) => available.includes(id));
  const rest = available.filter((id) => !ordered.includes(id));
  return [...ordered, ...rest].filter((id) => !pref.hidden.includes(id));
}

/** Todas las tarjetas del rol en el orden elegido, con las escondidas marcadas (para el diálogo). */
export function homeLayoutRows(
  available: readonly HomeSectionId[],
  pref: HomeLayoutPref | null
): { id: HomeSectionId; label: string; visible: boolean }[] {
  const ordered = pref ? pref.order.filter((id) => available.includes(id)) : [];
  const all = [...ordered, ...available.filter((id) => !ordered.includes(id))];
  return all.map((id) => ({ id, label: HOME_SECTION_LABELS[id], visible: !pref?.hidden.includes(id) }));
}
