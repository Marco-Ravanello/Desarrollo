import type { OrderStatus, Role } from "@prisma/client";
import { hasPermission, PERMISSIONS, PURCHASING_EDIT_ROLES } from "@/lib/permissions";

// Estados de una orden de compra y quién puede pasarla de uno a otro.
// Lo usan los botones (para mostrar solo los que cada rol puede usar) y la acción que guarda (para controlarlo).

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CUMPLIDA: "Cumplida",
  CANCELADA: "Cancelada",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}

/** Cambia los nombres internos de estado por los de pantalla en un texto viejo de la actividad. */
export function translateOrderStatuses(text: string): string {
  return text.replace(/\b(PENDIENTE_APROBACION|BORRADOR|APROBADA|RECHAZADA|CUMPLIDA|CANCELADA)\b/g, (s) => orderStatusLabel(s));
}

/** Quién hace cada paso: "edit" = quien carga órdenes; "approve" = quien aprueba (Superadmin y Administración General). */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, "edit" | "approve">>> = {
  BORRADOR: { PENDIENTE_APROBACION: "edit", CANCELADA: "edit" },
  PENDIENTE_APROBACION: { APROBADA: "approve", RECHAZADA: "approve", BORRADOR: "approve", CANCELADA: "approve" },
  APROBADA: { CANCELADA: "approve" },
  RECHAZADA: { BORRADOR: "edit" },
  // "Cumplida" la pone sola la app cuando se entregó todo.
  CUMPLIDA: {},
  CANCELADA: {},
};

export function canEditPurchaseOrders(role?: Role | string | null): boolean {
  return PURCHASING_EDIT_ROLES.includes(role as Role);
}

export function canApprovePurchaseOrders(role?: Role | string | null): boolean {
  return Boolean(role) && hasPermission(role as Role, PERMISSIONS.APPROVE_PURCHASE_ORDER);
}

/** ¿Puede este rol pasar la orden de un estado a otro? */
export function canChangeOrderStatus(role: Role | string | null | undefined, from: OrderStatus, to: OrderStatus): boolean {
  const who = TRANSITIONS[from]?.[to];
  if (who === "edit") return canEditPurchaseOrders(role);
  if (who === "approve") return canApprovePurchaseOrders(role);
  return false;
}

/** Los cambios de estado que este rol puede hacer desde el estado actual. */
export function allowedOrderTransitions(role: Role | string | null | undefined, from: OrderStatus): OrderStatus[] {
  return (Object.keys(TRANSITIONS[from] || {}) as OrderStatus[]).filter((to) => canChangeOrderStatus(role, from, to));
}
