// Cómo se muestra cada movimiento de la Auditoría: qué hizo la persona, en castellano,
// a qué grupo pertenece (para filtrar) y adónde lleva el enlace.
// En la base quedan las claves técnicas (CLOSE_CASE, PurchaseOrder…); esto es solo para mostrar.

import { orderStatusLabel, translateOrderStatuses } from "@/lib/purchase-orders";
import { reservationStatusLabel } from "@/lib/vehicle-reservations";

export type AuditGroup =
  | "expedientes"
  | "personas"
  | "compras"
  | "vehiculos"
  | "emergencia"
  | "usuarios"
  | "configuracion"
  | "descargas"
  | "ingresos";

export const AUDIT_GROUPS: { id: AuditGroup; label: string }[] = [
  { id: "expedientes", label: "Expedientes" },
  { id: "personas", label: "Personas y padrón" },
  { id: "compras", label: "Compras, proveedores y stock" },
  { id: "vehiculos", label: "Vehículos" },
  { id: "emergencia", label: "Emergencia climática" },
  { id: "usuarios", label: "Usuarios y contraseñas" },
  { id: "configuracion", label: "Configuración y presupuesto" },
  { id: "descargas", label: "Descargas de datos" },
  { id: "ingresos", label: "Ingresos a la app" },
];

/** Ingresos y contraseñas mal puestas: se ocultan salvo que se pidan. */
export const LOGIN_ACTIONS = ["LOGIN", "LOGIN_FAILED"];

const ACTIONS: Record<string, { label: string; group: AuditGroup }> = {
  // Expedientes
  CREATE_CASE: { label: "Abrió un expediente", group: "expedientes" },
  CLOSE_CASE: { label: "Cerró un expediente", group: "expedientes" },
  REOPEN_CASE: { label: "Reabrió un expediente", group: "expedientes" },
  ASSIGN_CASE: { label: "Cambió quién está a cargo", group: "expedientes" },
  CREATE_INTERVENTION: { label: "Cargó una intervención", group: "expedientes" },
  EDIT_INTERVENTION: { label: "Corrigió una intervención", group: "expedientes" },
  SCHEDULE_FOLLOW_UP: { label: "Agendó un seguimiento", group: "expedientes" },
  CASE_LABELS: { label: "Cambió las etiquetas de un expediente", group: "expedientes" },
  CASE_DERIVATION_CREATED: { label: "Derivó un expediente", group: "expedientes" },
  CASE_DERIVATION_ACCEPTED: { label: "Aceptó una derivación", group: "expedientes" },
  CASE_DERIVATION_REJECTED: { label: "Rechazó una derivación", group: "expedientes" },
  UPLOAD_DOCUMENT: { label: "Subió un documento", group: "expedientes" },
  // Personas y padrón
  ADD_FAMILY_MEMBER: { label: "Sumó un integrante a la familia", group: "personas" },
  PADRON_IMPORT: { label: "Importó una planilla al padrón", group: "personas" },
  PADRON_GEO_UPDATE: { label: "Ubicó una dirección en el mapa", group: "personas" },
  PADRON_DUPLICADO_UNIDO: { label: "Unió dos personas repetidas", group: "personas" },
  PADRON_DUPLICADO_DESCARTADO: { label: "Marcó que no son la misma persona", group: "personas" },
  PADRON_ALTA_EMERGENCIA: { label: "Sumó al padrón a una persona de una ficha de tormenta", group: "emergencia" },
  PADRON_PROGRAMA_EMERGENCIA: { label: "Anotó en Emergencia climática a una persona del padrón", group: "emergencia" },
  // Compras, proveedores y stock
  UPDATE_FULFILLMENT: { label: "Registró una entrega de una orden", group: "compras" },
  CREATE_PROVIDER: { label: "Dio de alta un proveedor", group: "compras" },
  UPDATE_PROVIDER: { label: "Editó un proveedor", group: "compras" },
  DELETE_PROVIDER: { label: "Borró un proveedor", group: "compras" },
  // Vehículos
  CREATE_VEHICLE: { label: "Dio de alta un vehículo", group: "vehiculos" },
  VEHICLE_RESERVATION_REQUEST: { label: "Pidió un vehículo", group: "vehiculos" },
  RESERVATION_RESCHEDULE: { label: "Movió una reserva de vehículo", group: "vehiculos" },
  FUEL_RECORD: { label: "Cargó combustible", group: "vehiculos" },
  // Emergencia climática
  STORM_VICTIM_REGISTERED: { label: "Cargó una ficha de tormenta", group: "emergencia" },
  STORM_VICTIM_DELETED: { label: "Borró una ficha de tormenta", group: "emergencia" },
  STORM_RECORD_DNI_COMPLETED: { label: "Completó el DNI de una ficha de tormenta", group: "emergencia" },
  STORM_DELIVERY: { label: "Registró una entrega de emergencia", group: "emergencia" },
  EMERGENCY_STOCK_UPDATE: { label: "Ajustó el stock de emergencia", group: "emergencia" },
  EMERGENCY_STOCK_ITEM_CREATED: { label: "Sumó un insumo de emergencia", group: "emergencia" },
  EMERGENCY_STOCK_DISPATCH: { label: "Despachó insumos de emergencia", group: "emergencia" },
  EMERGENCY_MODE_ACTIVATED: { label: "Activó la emergencia climática", group: "emergencia" },
  EMERGENCY_MODE_DEACTIVATED: { label: "Apagó la emergencia climática", group: "emergencia" },
  // Usuarios
  CREATE_USER: { label: "Creó un usuario", group: "usuarios" },
  UPDATE_USER: { label: "Editó un usuario", group: "usuarios" },
  ACTIVATE_USER: { label: "Reactivó un usuario", group: "usuarios" },
  DEACTIVATE_USER: { label: "Suspendió un usuario", group: "usuarios" },
  PASSWORD_RESET: { label: "Generó una clave temporal", group: "usuarios" },
  PASSWORD_CHANGED: { label: "Cambió su contraseña", group: "usuarios" },
  // Configuración y presupuesto
  UPDATE_SYSTEM_SETTINGS: { label: "Cambió la Configuración", group: "configuracion" },
  RESET_SYSTEM_SETTINGS: { label: "Volvió la Configuración a la de fábrica", group: "configuracion" },
  UPDATE_BUDGET: { label: "Cambió el presupuesto de un área", group: "configuracion" },
  // Descargas
  EXPORT_CSV: { label: "Descargó datos del padrón", group: "descargas" },
  EXPORT_MAP_PEOPLE: { label: "Descargó personas del Mapa Social", group: "descargas" },
  EXPORT_INTERVENTIONS: { label: "Descargó intervenciones", group: "descargas" },
  // Ingresos
  LOGIN: { label: "Entró a la app", group: "ingresos" },
  LOGIN_FAILED: { label: "Intentó entrar con una contraseña equivocada", group: "ingresos" },
};

/** Las acciones genéricas (CREATE, UPDATE, DELETE) se explican según lo que tocaron. */
const ENTITY_ACTIONS: Record<string, { CREATE?: string; UPDATE?: string; DELETE?: string; group: AuditGroup }> = {
  Person: { CREATE: "Cargó una persona", UPDATE: "Editó los datos de una persona", group: "personas" },
  Persona: { CREATE: "Cargó una persona", UPDATE: "Editó los datos de una persona", group: "personas" },
  PadronUnificado: { UPDATE: "Editó el padrón", group: "personas" },
  Family: { UPDATE: "Editó una familia", group: "personas" },
  Case: { CREATE: "Abrió un expediente", UPDATE: "Editó un expediente", DELETE: "Borró un expediente", group: "expedientes" },
  PurchaseOrder: { CREATE: "Cargó una orden de compra", UPDATE: "Editó una orden de compra", group: "compras" },
  SupplyItem: { CREATE: "Cargó un insumo", UPDATE: "Cambió el stock de un insumo", DELETE: "Borró un insumo", group: "compras" },
  Agreement: { CREATE: "Cargó un convenio", UPDATE: "Editó un convenio", group: "compras" },
  Provider: { CREATE: "Dio de alta un proveedor", UPDATE: "Editó un proveedor", DELETE: "Borró un proveedor", group: "compras" },
  Vehicle: { CREATE: "Dio de alta un vehículo", UPDATE: "Editó un vehículo", group: "vehiculos" },
  User: { CREATE: "Creó un usuario", UPDATE: "Editó un usuario", group: "usuarios" },
  Area: { UPDATE: "Editó un área", group: "configuracion" },
};

/** Qué es cada cosa que se tocó, para la columna "Sobre". */
const ENTITY_LABEL: Record<string, string> = {
  Case: "Expediente",
  Person: "Persona",
  Persona: "Persona",
  PadronUnificado: "Padrón",
  Family: "Familia",
  Derivation: "Derivación",
  Document: "Documento",
  PurchaseOrder: "Orden de compra",
  Provider: "Proveedor",
  SupplyItem: "Insumo",
  Agreement: "Convenio",
  Vehicle: "Vehículo",
  VehicleReservation: "Reserva de vehículo",
  FuelRecord: "Combustible",
  StormVictimRecord: "Ficha de tormenta",
  "Case/StormVictimRecord": "Ficha de tormenta",
  "SupplyItem/SystemSetting": "Insumo de emergencia",
  User: "Usuario",
  Area: "Área",
  SystemSetting: "Configuración",
  Intervention: "Intervenciones",
};

export function auditEntityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? entity;
}

/** "Rechazó una orden de compra", "Aprobó una reserva"… para las acciones que llevan el estado en el nombre. */
function statusAction(action: string): { label: string; group: AuditGroup } | null {
  const order = action.match(/^PURCHASE_ORDER_STATUS_(\w+)$/);
  if (order) {
    const verb: Record<string, string> = {
      APROBADA: "Aprobó una orden de compra",
      RECHAZADA: "Rechazó una orden de compra",
      CANCELADA: "Canceló una orden de compra",
      CUMPLIDA: "Una orden de compra quedó cumplida",
      PENDIENTE_APROBACION: "Mandó a aprobar una orden de compra",
      BORRADOR: "Devolvió una orden de compra a borrador",
    };
    return { label: verb[order[1]] ?? `Pasó una orden de compra a "${orderStatusLabel(order[1])}"`, group: "compras" };
  }
  const reservation = action.match(/^RESERVATION_(\w+)$/);
  if (reservation) {
    const verb: Record<string, string> = {
      APROBADA: "Aprobó una reserva de vehículo",
      RECHAZADA: "Rechazó una reserva de vehículo",
      CANCELADA: "Canceló una reserva de vehículo",
      EN_CURSO: "Marcó la salida de un vehículo",
      FINALIZADA: "Marcó la vuelta de un vehículo",
    };
    return {
      label: verb[reservation[1]] ?? `Pasó una reserva a "${reservationStatusLabel(reservation[1])}"`,
      group: "vehiculos",
    };
  }
  return null;
}

/** Qué hizo la persona, en castellano, y en qué grupo va. */
export function describeAuditAction(action: string, entity: string): { label: string; group: AuditGroup } {
  const known = ACTIONS[action] ?? statusAction(action);
  if (known) return known;
  const byEntity = ENTITY_ACTIONS[entity];
  const generic = action === "CREATE" || action === "UPDATE" || action === "DELETE" ? byEntity?.[action] : undefined;
  if (generic && byEntity) return { label: generic, group: byEntity.group };
  const fallbackVerb: Record<string, string> = { CREATE: "Cargó", UPDATE: "Editó", DELETE: "Borró" };
  if (fallbackVerb[action]) {
    return { label: `${fallbackVerb[action]}: ${auditEntityLabel(entity).toLowerCase()}`, group: byEntity?.group ?? "configuracion" };
  }
  // Una acción que no está en la lista (por ejemplo, de una versión vieja de la app): se muestra legible.
  const readable = action.toLowerCase().replace(/_/g, " ");
  return { label: readable.charAt(0).toUpperCase() + readable.slice(1), group: byEntity?.group ?? "configuracion" };
}

/** Todas las claves de acción de un grupo (para filtrar en la base). */
export function actionsInGroup(group: AuditGroup): { actions: string[]; prefixes: string[]; entities: string[] } {
  const actions = Object.entries(ACTIONS).filter(([, v]) => v.group === group).map(([k]) => k);
  const prefixes = group === "compras" ? ["PURCHASE_ORDER_STATUS_"] : group === "vehiculos" ? ["RESERVATION_"] : [];
  // Las genéricas (CREATE/UPDATE/DELETE) se reconocen por lo que tocaron.
  const entities = Object.entries(ENTITY_ACTIONS).filter(([, v]) => v.group === group).map(([k]) => k);
  return { actions, prefixes, entities };
}

const DETAIL_KEYS: Record<string, string> = {
  dni: "DNI",
  memberDni: "DNI del integrante",
  number: "Orden",
  name: "Nombre",
  title: "Título",
  newStock: "Stock nuevo",
  relationship: "Vínculo",
};

/**
 * El detalle en texto. Algunos movimientos guardan los datos como JSON ({"dni":"123"});
 * se muestran como "DNI 123". Los identificadores internos no se muestran.
 */
export function formatAuditDetails(details: string | null | undefined): string {
  if (!details) return "";
  const text = details.trim();
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      const parts = Object.entries(data)
        .filter(([k, v]) => DETAIL_KEYS[k] && v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `${DETAIL_KEYS[k]}: ${String(v)}`);
      return parts.join(" · ");
    } catch {
      return text;
    }
  }
  return translateOrderStatuses(text);
}

/** El DNI que figura en el movimiento, si hay uno (para enlazar a la ficha). */
function dniFrom(entity: string, entityId: string, details: string | null | undefined): string | null {
  if ((entity === "Persona" || entity === "PadronUnificado") && /^\d{6,9}$/.test(entityId)) return entityId;
  if (details?.trim().startsWith("{")) {
    try {
      const data = JSON.parse(details) as Record<string, unknown>;
      const dni = data.dni ?? data.memberDni;
      if (typeof dni === "string" && /^\d{6,9}$/.test(dni)) return dni;
    } catch {
      /* el detalle no es JSON */
    }
  }
  return null;
}

/** Adónde lleva el movimiento, si hay una pantalla para verlo. */
export function auditLink(log: { action: string; entity: string; entityId: string; details?: string | null }): string | null {
  const { action, entity, entityId } = log;
  if (LOGIN_ACTIONS.includes(action) || action === "PASSWORD_CHANGED") return null;
  const dni = dniFrom(entity, entityId, log.details);
  if (dni) return `/people/${dni}`;
  if (!entityId || entityId === "ALL") return null;
  switch (entity) {
    case "Case":
      return `/cases/${entityId}`;
    case "PurchaseOrder":
      return `/admin/purchase-orders/${entityId}`;
    case "Provider":
      return action === "DELETE_PROVIDER" ? null : `/admin/providers/${entityId}`;
    case "Agreement":
      return `/admin/agreements/${entityId}`;
    case "Vehicle":
      return `/admin/vehicles/${entityId}`;
    case "VehicleReservation":
      return "/admin/vehicles";
    case "User":
      return "/admin/users";
    case "Area":
      return "/admin/budget";
    case "SystemSetting":
      return entityId === "muni-emergency-mode" ? "/admin/emergency" : "/admin/settings";
    case "StormVictimRecord":
    case "Case/StormVictimRecord":
      return "/admin/emergency";
    case "SupplyItem":
      return "/admin/stock";
    default:
      return null;
  }
}
