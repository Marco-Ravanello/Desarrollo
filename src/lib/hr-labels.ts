import { diaAR } from "@/lib/fechas";

// Recursos Humanos: nombres en castellano para lo que la base guarda en mayúsculas.

export const HR_STATUS_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  LICENCIA: "De licencia",
  LICENCIA_SIN_GOCE: "De licencia sin goce",
  VACACIONES: "De vacaciones",
  BAJA: "De baja",
};

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  MENSUALIZADO: "Mensualizado",
  PLANTA_PERMANENTE: "Planta permanente",
  MONOTRIBUTISTA: "Monotributista / contratado",
};

/** Las situaciones de revista, en el orden en que se eligen en el formulario. */
export const HR_STATUS_OPTIONS = [
  { value: "ACTIVO", label: "Activo" },
  { value: "LICENCIA", label: "Licencia" },
  { value: "LICENCIA_SIN_GOCE", label: "Licencia sin goce" },
  { value: "VACACIONES", label: "Vacaciones" },
  { value: "BAJA", label: "Baja" },
] as const;

/** Las situaciones en las que la persona no viene a trabajar (y tienen fecha "hasta"). */
export const AWAY_STATUSES = ["LICENCIA", "LICENCIA_SIN_GOCE", "VACACIONES"] as const;
export const isAwayStatus = (s?: string | null) => (AWAY_STATUSES as readonly string[]).includes(s ?? "");

export const hrStatusLabel = (status?: string | null) => HR_STATUS_LABEL[status || "ACTIVO"] ?? status ?? "Activo";
export const contractTypeLabel = (type?: string | null) => CONTRACT_TYPE_LABEL[type || "MENSUALIZADO"] ?? type ?? "Mensualizado";

/**
 * El mes en curso (hora de Argentina) para comparar con la fecha de ingreso,
 * que se guarda como día de calendario a las 00:00 UTC.
 */
export function currentMonthRange(now = new Date()): { from: Date; to: Date } {
  const [y, m] = diaAR(now).split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

/** Quién ve Recursos Humanos (la lista y cada legajo): Superadmin, Administración General y Dirección General. */
export function canViewHR(role?: string | null): boolean {
  return role === "SUPERADMIN" || role === "ADMIN_GENERAL" || role === "DIRECCION_GENERAL";
}

/** Quién edita los legajos (y marca que alguien volvió de una licencia): Superadmin y Administración General. */
export function canEditHR(role?: string | null): boolean {
  return role === "SUPERADMIN" || role === "ADMIN_GENERAL";
}
