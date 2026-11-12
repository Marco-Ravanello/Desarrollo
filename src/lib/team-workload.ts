import type { Role } from "@prisma/client";
import { MANAGEMENT_ROLES } from "@/lib/permissions";

// Carga del equipo: reglas sin base de datos (quién la ve y a quién conviene asignar).

export type WorkloadMember = {
  userId: string;
  name: string;
  role: Role;
  /** Del área (false = de otra área pero con expedientes de esta a cargo). */
  member: boolean;
  /** Puede quedar a cargo de los expedientes del área. */
  eligible: boolean;
  open: number;
  urgent: number;
  stale: number;
  /** Expedientes que le asignaron en los últimos 7 días. */
  recent: number;
  /** Intervenciones en expedientes del área en los últimos 30 días, cargadas o acompañadas (idea 124). */
  done?: number;
  /** De esas, cuántas hizo junto con otros profesionales. */
  doneShared?: number;
  /** "De licencia hasta el 20/11" si hoy está fuera según su legajo de RRHH (idea 127); null si no. */
  away?: string | null;
};

/** La conducción ve cualquier área; quien dirige un área, solo la suya. */
export function canViewTeamWorkload(user: { role: Role; areaId?: string | null }, areaId: string | null): boolean {
  if (!areaId) return false;
  if (MANAGEMENT_ROLES.includes(user.role)) return true;
  return user.role === "DIRECTOR_AREA" && user.areaId === areaId;
}

/** A quién se puede proponer: primero profesionales del área; si no hay, quien la dirige. Nunca a quien está de licencia. */
function candidates(rows: WorkloadMember[]): WorkloadMember[] {
  const usable = rows.filter((r) => r.member && r.eligible && !r.away);
  const professionals = usable.filter((r) => r.role !== "DIRECTOR_AREA");
  return professionals.length > 0 ? professionals : usable;
}

/** Quien tiene menos expedientes abiertos (y, si empatan, menos urgentes y menos recién asignados). */
export function pickLeastLoaded(rows: WorkloadMember[]): WorkloadMember | null {
  const list = candidates(rows);
  if (list.length === 0) return null;
  return [...list].sort(
    (a, b) => a.open - b.open || a.urgent - b.urgent || a.recent - b.recent || a.name.localeCompare(b.name, "es")
  )[0];
}

/** Orden de la tabla: más expedientes abiertos primero. */
export function sortByLoad(rows: WorkloadMember[]): WorkloadMember[] {
  return [...rows].sort((a, b) => b.open - a.open || b.urgent - a.urgent || a.name.localeCompare(b.name, "es"));
}

/** En el diálogo de asignar: quién del área tiene menos expedientes abiertos (profesionales primero, sin los que están de licencia). */
export function suggestAssignee<T extends { id: string; name: string; role: Role; open: number; sameArea: boolean; away?: string | null }>(options: T[]): T | null {
  const area = options.filter((o) => o.sameArea && !o.away);
  const professionals = area.filter((o) => o.role !== "DIRECTOR_AREA");
  const list = professionals.length > 0 ? professionals : area;
  if (list.length === 0) return null;
  return [...list].sort((a, b) => a.open - b.open || a.name.localeCompare(b.name, "es"))[0];
}

/** Quienes están de licencia hoy y tienen expedientes sin cerrar a cargo: para avisar y repartirlos (idea 127). */
export function awayWithCases(rows: WorkloadMember[]): WorkloadMember[] {
  return rows.filter((r) => r.away && r.open > 0).sort((a, b) => b.urgent - a.urgent || b.open - a.open);
}

export const DONE_DAYS = 30;

/**
 * Cuántas intervenciones cuentan para cada profesional: las que cargó y aquellas en las que fue
 * con quien la cargó (idea 124). "shared" son las que hizo junto con alguien más.
 */
export function tallyInterventions(rows: { userId: string; withUserIds: string[] | null }[]): Map<string, { total: number; shared: number }> {
  const out = new Map<string, { total: number; shared: number }>();
  for (const r of rows) {
    const people = Array.from(new Set([r.userId, ...(r.withUserIds ?? [])].filter(Boolean)));
    const shared = people.length > 1;
    for (const id of people) {
      const t = out.get(id) ?? { total: 0, shared: 0 };
      t.total += 1;
      if (shared) t.shared += 1;
      out.set(id, t);
    }
  }
  return out;
}
