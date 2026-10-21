import type { Role } from "@prisma/client";

// Nombres de los roles para mostrar en pantalla (en la base quedan las claves técnicas).

export const ROLE_INFO: Record<Role, { label: string; description: string; badgeClass: string }> = {
  SUPERADMIN: {
    label: "Superadmin",
    description: "Acceso total. Es el único que crea usuarios y restablece contraseñas.",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  DIRECCION_GENERAL: {
    label: "Dirección General",
    description: "Conducción: ve toda la Secretaría, la Sala de Situación, los reportes y los expedientes reservados.",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  ADMIN_GENERAL: {
    label: "Administración General",
    description: "Conducción: compras, insumos, vehículos y recursos de las áreas. Ve todos los expedientes.",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  DIRECTOR_AREA: {
    label: "Dirección de Área",
    description: "Conduce su área: expedientes, derivaciones, profesional a cargo y reportes.",
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  },
  OPERATIVO: {
    label: "Operativo / Trabajo social",
    description: "Carga expedientes, intervenciones y la asistencia directa de su área.",
    badgeClass: "bg-muted text-foreground border-border",
  },
  AUDITOR: {
    label: "Auditoría",
    description: "Consulta y controla todo, pero no carga ni modifica datos.",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  VIOLENCIA_GENERO: {
    label: "Violencia de Género",
    description: "Trabaja los expedientes reservados de Violencia de Género.",
    badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  },
  RELEVADOR_EMERGENCIA: {
    label: "Relevamiento de emergencia",
    description: "Solo carga fichas de emergencia climática y ve las que cargó.",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
};

/** Orden para listas y selectores: de más acceso a menos. */
export const ROLE_ORDER: Role[] = [
  "SUPERADMIN",
  "DIRECCION_GENERAL",
  "ADMIN_GENERAL",
  "DIRECTOR_AREA",
  "OPERATIVO",
  "VIOLENCIA_GENERO",
  "AUDITOR",
  "RELEVADOR_EMERGENCIA",
];

export function roleLabel(role?: Role | string | null): string {
  return (role && ROLE_INFO[role as Role]?.label) || "Sin rol";
}
