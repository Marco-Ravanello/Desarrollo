import { CASE_STATUS_LABEL, CASE_PRIORITY_LABEL } from "@/lib/case-summary";
import { ORDER_STATUS_LABEL } from "@/lib/purchase-orders";
import {
  CASE_STATUS_TONE, ORDER_STATUS_TONE, PRIORITY_TONE, STATUS_TONE_CLASS, toneOf, type StatusTone,
} from "@/lib/status-tones";

// Nombre y color de los estados de expedientes y órdenes. Los colores salen de lib/status-tones.ts,
// así cada estado se ve igual en todas las pantallas.

export interface StatusStyleConfig {
  label: string;
  tone: StatusTone;
  badgeClass: string;
}

function config(label: string, tone: StatusTone): StatusStyleConfig {
  return { label, tone, badgeClass: STATUS_TONE_CLASS[tone] };
}

export function getCaseStatusConfig(status: string): StatusStyleConfig {
  return config(CASE_STATUS_LABEL[status] ?? status, toneOf(CASE_STATUS_TONE, status));
}

export function getPriorityConfig(priority: string): StatusStyleConfig {
  return config(CASE_PRIORITY_LABEL[priority] ?? priority, toneOf(PRIORITY_TONE, priority));
}

export function getOrderStatusConfig(status: string): StatusStyleConfig {
  return config(ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL] ?? status, toneOf(ORDER_STATUS_TONE, status));
}
