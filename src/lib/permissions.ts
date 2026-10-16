import { Role } from "@prisma/client";

export const PERMISSIONS = {
  APPROVE_PURCHASE_ORDER: "approve_purchase_order",
  CLOSE_PURCHASE_ORDER: "close_purchase_order",
  VIEW_REPORTS: "view_reports",
  VIEW_SENSITIVE_CASES: "view_sensitive_cases",
  MANAGE_USERS: "manage_users",
  VIEW_AUDIT_LOGS: "view_audit_logs",
  EXPORT_PERSONAL_DATA: "export_personal_data",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: Object.values(PERMISSIONS),
  DIRECCION_GENERAL: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_SENSITIVE_CASES,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.EXPORT_PERSONAL_DATA,
  ],
  ADMIN_GENERAL: [
    PERMISSIONS.APPROVE_PURCHASE_ORDER,
    PERMISSIONS.CLOSE_PURCHASE_ORDER,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.VIEW_SENSITIVE_CASES,
    PERMISSIONS.EXPORT_PERSONAL_DATA,
  ],
  DIRECTOR_AREA: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_PERSONAL_DATA,
  ],
  OPERATIVO: [],
  AUDITOR: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
  ],
  VIOLENCIA_GENERO: [
    PERMISSIONS.VIEW_SENSITIVE_CASES,
  ],
  RELEVADOR_EMERGENCIA: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ---------------------------------------------------------------------------
// Acceso a pantallas por rol. Lo usan el middleware (bloquea la URL aunque se
// escriba a mano) y el menú lateral (muestra solo lo que cada rol puede abrir).
// Las acciones que guardan datos controlan además su propio permiso.
// ---------------------------------------------------------------------------

/** Conducción: ven y administran toda la gestión. */
export const MANAGEMENT_ROLES: Role[] = ["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"];
/** Pueden consultar compras, proveedores, convenios y stock. */
export const PURCHASING_VIEW_ROLES: Role[] = [...MANAGEMENT_ROLES, "DIRECTOR_AREA", "AUDITOR"];
/** Pueden cargar órdenes de compra y registrar entregas. */
export const PURCHASING_EDIT_ROLES: Role[] = [...MANAGEMENT_ROLES, "DIRECTOR_AREA"];
/** Administran la flota (altas de vehículos, aprobación de reservas). */
export const FLEET_ADMIN_ROLES: Role[] = ["SUPERADMIN", "ADMIN_GENERAL"];
/** Usan el Asistente de IA (consulta toda la base, incluidos casos sensibles). */
export const AI_ASSISTANT_ROLES: Role[] = [...MANAGEMENT_ROLES, "DIRECTOR_AREA"];

export function canUseAiAssistant(role?: Role | string | null): boolean {
  return AI_ASSISTANT_ROLES.includes(role as Role);
}

/**
 * Relevamiento de emergencia climática: solo carga fichas de emergencia y ve
 * las que cargó. No ve stock ni el resto de la gestión.
 */
export function isEmergencySurveyor(role?: Role | string | null): boolean {
  return role === "RELEVADOR_EMERGENCIA";
}

/** Pantallas que puede abrir el relevador de emergencia. */
const EMERGENCY_SURVEYOR_PATHS = ["/admin/emergency"];

/** Pantalla de inicio de cada rol (el relevador entra directo a sus fichas). */
export function homePathFor(role?: Role | string | null): string {
  return isEmergencySurveyor(role) ? "/admin/emergency" : "/dashboard";
}

/** Ver y mover el stock de contingencia: no el relevador ni Auditoría. */
export function canManageEmergencyStock(role?: Role | string | null): boolean {
  return canEditSocialRecords(role) && !isEmergencySurveyor(role);
}

/** Auditoría consulta pero no carga ni modifica datos sociales. */
export function canEditSocialRecords(role?: Role | string | null): boolean {
  return Boolean(role) && role !== "AUDITOR";
}

const ROUTE_ACCESS: { prefix: string; allowed: (role: Role) => boolean }[] = [
  // Compras y presupuesto
  { prefix: "/admin/purchase-orders/new", allowed: (r) => PURCHASING_EDIT_ROLES.includes(r) },
  { prefix: "/admin/agreements/new", allowed: (r) => MANAGEMENT_ROLES.includes(r) },
  { prefix: "/admin/purchase-orders", allowed: (r) => PURCHASING_VIEW_ROLES.includes(r) },
  { prefix: "/admin/providers", allowed: (r) => PURCHASING_VIEW_ROLES.includes(r) },
  { prefix: "/admin/agreements", allowed: (r) => PURCHASING_VIEW_ROLES.includes(r) },
  { prefix: "/admin/budget", allowed: (r) => PURCHASING_VIEW_ROLES.includes(r) },
  { prefix: "/admin/reports", allowed: (r) => hasPermission(r, PERMISSIONS.VIEW_REPORTS) },
  // Recursos
  { prefix: "/admin/stock", allowed: (r) => PURCHASING_VIEW_ROLES.includes(r) },
  { prefix: "/admin/hr", allowed: (r) => MANAGEMENT_ROLES.includes(r) },
  { prefix: "/admin/vehicles/new", allowed: (r) => FLEET_ADMIN_ROLES.includes(r) },
  { prefix: "/admin/vehicles/requests", allowed: (r) => FLEET_ADMIN_ROLES.includes(r) },
  { prefix: "/admin/vehicles/reports", allowed: (r) => [...MANAGEMENT_ROLES, "AUDITOR"].includes(r) },
  // Sistema
  { prefix: "/admin/assistant", allowed: (r) => canUseAiAssistant(r) },
  { prefix: "/admin/settings", allowed: (r) => MANAGEMENT_ROLES.includes(r) },
  { prefix: "/admin/users", allowed: (r) => MANAGEMENT_ROLES.includes(r) || hasPermission(r, PERMISSIONS.MANAGE_USERS) },
  { prefix: "/admin/interventions", allowed: (r) => MANAGEMENT_ROLES.includes(r) },
  { prefix: "/admin/audit", allowed: (r) => hasPermission(r, PERMISSIONS.VIEW_AUDIT_LOGS) },
  // Áreas sensibles
  { prefix: "/areas/violence", allowed: (r) => hasPermission(r, PERMISSIONS.VIEW_SENSITIVE_CASES) },
  // Carga de datos sociales (Auditoría solo consulta)
  { prefix: "/people/new", allowed: (r) => canEditSocialRecords(r) },
  { prefix: "/cases/new", allowed: (r) => canEditSocialRecords(r) },
  // Ubicar en el mapa las direcciones del padrón
  { prefix: "/maps/ubicar", allowed: (r) => MANAGEMENT_ROLES.includes(r) },
];

/** ¿Puede este rol abrir esta pantalla? Las rutas que no figuran arriba son de uso general. */
export function canAccessPath(role: Role | string | null | undefined, pathname: string): boolean {
  if (isEmergencySurveyor(role)) {
    return EMERGENCY_SURVEYOR_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }
  const rule = ROUTE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (!rule) return true;
  return Boolean(role) && rule.allowed(role as Role);
}
