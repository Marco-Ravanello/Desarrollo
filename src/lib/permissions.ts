import { Role } from "@prisma/client";

export const PERMISSIONS = {
  APPROVE_PURCHASE_ORDER: "approve_purchase_order",
  CLOSE_PURCHASE_ORDER: "close_purchase_order",
  VIEW_REPORTS: "view_reports",
  VIEW_SENSITIVE_CASES: "view_sensitive_cases",
  MANAGE_USERS: "manage_users",
  VIEW_AUDIT_LOGS: "view_audit_logs",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: Object.values(PERMISSIONS),
  DIRECCION_GENERAL: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_SENSITIVE_CASES,
    PERMISSIONS.VIEW_AUDIT_LOGS,
  ],
  ADMIN_GENERAL: [
    PERMISSIONS.APPROVE_PURCHASE_ORDER,
    PERMISSIONS.CLOSE_PURCHASE_ORDER,
    PERMISSIONS.VIEW_REPORTS,
  ],
  DIRECTOR_AREA: [
    PERMISSIONS.VIEW_REPORTS,
  ],
  OPERATIVO: [],
  AUDITOR: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
  ],
  VIOLENCIA_GENERO: [
    PERMISSIONS.VIEW_SENSITIVE_CASES,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
