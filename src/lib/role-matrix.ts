// Qué puede ver y hacer cada rol, para la tabla del Superadmin (Usuarios > Permisos por rol).
// Cada fila se calcula con las mismas reglas que usa la app, así la tabla no se desactualiza cuando cambian.
// Sin base de datos, para poder probarlo solo.

import type { Role } from "@prisma/client";
import {
  FLEET_ADMIN_ROLES,
  MANAGEMENT_ROLES,
  PERMISSIONS,
  PURCHASING_VIEW_ROLES,
  canAccessPath,
  canCreateUsersAndResetPasswords,
  canEditSocialRecords,
  canManageEmergencyStock,
  canUseAiAssistant,
  hasPermission,
  isEmergencySurveyor,
} from "@/lib/permissions";
import { ROLE_ORDER } from "@/lib/roles";
import { canEditHR, canViewHR } from "@/lib/hr-labels";
import { canApprovePurchaseOrders, canEditPurchaseOrders } from "@/lib/purchase-orders";
import { canAssignCase, canTakeCase } from "@/lib/case-assignment";
import { canCloseOrReopenCase } from "@/lib/case-closing";
import { canAssignProgramArea, canManageProgram } from "@/lib/program-ownership";
import { canClosePeriod, canLoadHours } from "@/lib/convenio-gasto";
import { canPlanRecorridas } from "@/lib/recorridas";
import { canCreateCursos } from "@/lib/cursos";
import { canViewTeamWorkload } from "@/lib/team-workload";
import { TASK_MANAGER_ROLES } from "@/lib/tasks";

/** "si": todo; "parcial": con un límite (la nota dice cuál); "no": no puede. */
export type Access = { level: "si" | "parcial" | "no"; note?: string };
export type MatrixRow = { label: string; hint?: string; access: (role: Role) => Access };
export type MatrixGroup = { title: string; rows: MatrixRow[] };

const yes: Access = { level: "si" };
const no: Access = { level: "no" };
const bool = (ok: boolean): Access => (ok ? yes : no);

const OWN = "area-propia";
const OTHER = "otra-area";

/**
 * Para las reglas que dependen del área: si puede en cualquier área es "sí"; si solo en la suya, "parcial"
 * con la nota; si en ninguna, "no".
 */
function byArea(check: (role: Role, userArea: string, targetArea: string) => boolean, note: string) {
  return (role: Role): Access => {
    const own = check(role, OWN, OWN);
    const other = check(role, OWN, OTHER);
    if (own && other) return yes;
    if (own) return { level: "parcial", note };
    return no;
  };
}

/** Una pantalla: la abre si la deja pasar el control de rutas y, si hace falta, el control de la propia página. */
const screen = (path: string, extra?: (role: Role) => boolean) => (role: Role) => bool(canAccessPath(role, path) && (extra ? extra(role) : true));

const MANAGEMENT = (r: Role) => MANAGEMENT_ROLES.includes(r);
/** Carga datos sociales en la app (Auditoría solo consulta; el relevador solo carga fichas de emergencia). */
const editsSocial = (r: Role) => canEditSocialRecords(r) && !isEmergencySurveyor(r);

export const ROLE_MATRIX: MatrixGroup[] = [
  {
    title: "Personas y expedientes",
    rows: [
      { label: "Registro Único y fichas de las personas", access: screen("/people") },
      { label: "Cargar personas y editar sus datos", access: (r) => bool(screen("/people/new")(r).level === "si" && editsSocial(r)) },
      { label: "Posibles duplicados y unir fichas", access: screen("/people/duplicados") },
      { label: "Calidad de los datos del padrón", access: screen("/people/calidad", MANAGEMENT) },
      { label: "Expedientes", access: screen("/cases") },
      { label: "Abrir expedientes y cargar intervenciones", access: (r) => bool(canAccessPath(r, "/cases/new") && editsSocial(r)) },
      {
        label: "Asignar el profesional a cargo",
        access: byArea((r, u, t) => canAssignCase({ role: r, areaId: u }, t), "Solo en su área"),
      },
      {
        label: "Tomar un expediente sin profesional (\"Lo tomo yo\")",
        access: byArea((r, u, t) => canTakeCase({ role: r, areaId: u }, t), "Los de su área"),
      },
      {
        label: "Cerrar y reabrir expedientes",
        access: (r) =>
          !canCloseOrReopenCase({ role: r }, "Protección Social")
            ? no
            : canCloseOrReopenCase({ role: r }, "Violencia de Género")
              ? yes
              : { level: "parcial", note: "No los de Violencia de Género" },
      },
      { label: "Carga del equipo", access: byArea((r, u, t) => canAccessPath(r, "/cases/equipo") && canViewTeamWorkload({ role: r, areaId: u }, t), "Solo su área") },
      {
        label: "Expedientes reservados de Violencia de Género",
        hint: "Verlos en las listas, el mapa, la Sala de Situación y los reportes.",
        access: (r) => bool(hasPermission(r, PERMISSIONS.VIEW_SENSITIVE_CASES)),
      },
      { label: "Descargar datos personales (Excel)", access: (r) => bool(hasPermission(r, PERMISSIONS.EXPORT_PERSONAL_DATA)) },
    ],
  },
  {
    title: "Programas, barrios y cursos",
    rows: [
      { label: "Programas", access: screen("/people/programas") },
      {
        label: "Dar altas y bajas en un programa",
        access: byArea((r, u, t) => canManageProgram({ role: r, areaId: u }, t), "Los de su área y los que no tienen área"),
      },
      { label: "Elegir el área a cargo de un programa", access: (r) => bool(canAssignProgramArea(r)) },
      { label: "Barrios y Mapa Social", access: screen("/barrios") },
      { label: "Ubicar direcciones en el mapa", access: screen("/maps/ubicar", MANAGEMENT) },
      { label: "Armar recorridas y cargar lugares de referencia", access: (r) => bool(canAccessPath(r, "/barrios") && canPlanRecorridas(r)) },
      { label: "Crear cursos y tomar asistencia", access: (r) => bool(canAccessPath(r, "/cursos") && canCreateCursos(r)) },
    ],
  },
  {
    title: "Tareas y agenda",
    rows: [
      { label: "Mis tareas y Agenda", access: screen("/tasks") },
      { label: "Editar o marcar las tareas de otras personas", access: (r) => bool(canAccessPath(r, "/tasks") && TASK_MANAGER_ROLES.includes(r)) },
    ],
  },
  {
    title: "Compras y recursos",
    rows: [
      { label: "Órdenes de compra, proveedores y presupuesto", access: screen("/admin/purchase-orders", (r) => PURCHASING_VIEW_ROLES.includes(r)) },
      { label: "Cargar órdenes de compra y entregas", access: (r) => bool(canAccessPath(r, "/admin/purchase-orders/new") && canEditPurchaseOrders(r)) },
      { label: "Aprobar o rechazar órdenes de compra", access: (r) => bool(canApprovePurchaseOrders(r)) },
      { label: "Convenios", access: screen("/admin/agreements") },
      {
        label: "Cargar las horas de un convenio",
        access: byArea((r, u, t) => canAccessPath(r, "/admin/agreements") && canLoadHours({ role: r, areaId: u }, { areaId: t }), "Los de su área"),
      },
      {
        label: "Cerrar el período de un convenio",
        access: byArea((r, u, t) => canAccessPath(r, "/admin/agreements") && canClosePeriod({ role: r, areaId: u }, { areaId: t }), "Los de su área"),
      },
      { label: "Stock", access: screen("/admin/stock", (r) => canManageEmergencyStock(r) || r === "AUDITOR") },
      { label: "Reservar vehículos", access: screen("/admin/vehicles") },
      { label: "Aprobar reservas y cargar vehículos", access: (r) => bool(FLEET_ADMIN_ROLES.includes(r)) },
      { label: "Recursos Humanos (legajos y licencias)", access: screen("/admin/hr", (r) => canViewHR(r)) },
      { label: "Editar legajos", access: (r) => bool(canAccessPath(r, "/admin/hr") && canEditHR(r)) },
    ],
  },
  {
    title: "Conducción y sistema",
    rows: [
      { label: "Sala de Situación", access: screen("/admin/war-room") },
      { label: "Reportes", access: screen("/admin/reports") },
      {
        label: "Asistente de IA",
        access: (r) => (!canUseAiAssistant(r) ? no : MANAGEMENT(r) ? yes : { level: "parcial", note: "Solo los datos de su área" }),
      },
      { label: "Preguntas que el asistente no pudo responder", access: screen("/admin/assistant/sin-respuesta") },
      { label: "Usuarios: editar nombre, rol y área", access: screen("/admin/users") },
      { label: "Crear usuarios y dar claves temporales", access: (r) => bool(canCreateUsersAndResetPasswords(r)) },
      { label: "Permisos por rol (esta tabla)", access: screen("/admin/users/permisos") },
      { label: "Auditoría", access: screen("/admin/audit") },
      { label: "Configuración", access: screen("/admin/settings") },
      { label: "Fichas de emergencia climática", access: screen("/admin/emergency") },
    ],
  },
];

/** Los roles en el orden de las columnas. */
export const MATRIX_ROLES: Role[] = ROLE_ORDER;

/** Cuántas cosas puede hacer cada rol (completas y con límite), para el resumen de arriba de cada columna. */
export function roleTotals(role: Role, groups: MatrixGroup[] = ROLE_MATRIX): { si: number; parcial: number; total: number } {
  const rows = groups.flatMap((g) => g.rows);
  let si = 0;
  let parcial = 0;
  for (const row of rows) {
    const a = row.access(role);
    if (a.level === "si") si++;
    else if (a.level === "parcial") parcial++;
  }
  return { si, parcial, total: rows.length };
}
