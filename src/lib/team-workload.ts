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
};

/** La conducción ve cualquier área; quien dirige un área, solo la suya. */
export function canViewTeamWorkload(user: { role: Role; areaId?: string | null }, areaId: string | null): boolean {
  if (!areaId) return false;
  if (MANAGEMENT_ROLES.includes(user.role)) return true;
  return user.role === "DIRECTOR_AREA" && user.areaId === areaId;
}

/** A quién se puede proponer: primero profesionales del área; si no hay, quien la dirige. */
function candidates(rows: WorkloadMember[]): WorkloadMember[] {
  const usable = rows.filter((r) => r.member && r.eligible);
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

/** En el diálogo de asignar: quién del área tiene menos expedientes abiertos (profesionales primero). */
export function suggestAssignee<T extends { id: string; name: string; role: Role; open: number; sameArea: boolean }>(options: T[]): T | null {
  const area = options.filter((o) => o.sameArea);
  const professionals = area.filter((o) => o.role !== "DIRECTOR_AREA");
  const list = professionals.length > 0 ? professionals : area;
  if (list.length === 0) return null;
  return [...list].sort((a, b) => a.open - b.open || a.name.localeCompare(b.name, "es"))[0];
}
