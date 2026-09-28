export interface StatusStyleConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
}

export const CASE_STATUS_CONFIG: Record<string, StatusStyleConfig> = {
  ABIERTO: {
    label: "Abierto",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-500/30",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold",
  },
  EN_PROCESO: {
    label: "En Proceso",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold",
  },
  EN_ESPERA: {
    label: "En Espera",
    bgClass: "bg-purple-500/10 dark:bg-purple-500/20",
    textClass: "text-purple-700 dark:text-purple-300",
    borderClass: "border-purple-500/30",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 font-semibold",
  },
  RESUELTO: {
    label: "Resuelto",
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/20",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-500/30",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold",
  },
  CERRADO: {
    label: "Cerrado",
    bgClass: "bg-slate-500/10 dark:bg-slate-500/20",
    textClass: "text-slate-700 dark:text-slate-300",
    borderClass: "border-slate-500/30",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 font-semibold",
  },
  DERIVADO: {
    label: "Derivado",
    bgClass: "bg-indigo-500/10 dark:bg-indigo-500/20",
    textClass: "text-indigo-700 dark:text-indigo-300",
    borderClass: "border-indigo-500/30",
    badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-semibold",
  },
};

export const PRIORITY_CONFIG: Record<string, StatusStyleConfig> = {
  ALTA: {
    label: "Urgente",
    bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
    textClass: "text-rose-700 dark:text-rose-300",
    borderClass: "border-rose-500/30",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold",
  },
  MEDIA: {
    label: "Media",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold",
  },
  BAJA: {
    label: "Baja",
    bgClass: "bg-slate-500/10 dark:bg-slate-500/20",
    textClass: "text-slate-700 dark:text-slate-300",
    borderClass: "border-slate-500/30",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium",
  },
};

export const ORDER_STATUS_CONFIG: Record<string, StatusStyleConfig> = {
  BORRADOR: {
    label: "Borrador",
    bgClass: "bg-slate-500/10 dark:bg-slate-500/20",
    textClass: "text-slate-700 dark:text-slate-300",
    borderClass: "border-slate-500/30",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium",
  },
  PENDIENTE_APROBACION: {
    label: "Pendiente Aprobación",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold animate-pulse",
  },
  APROBADA: {
    label: "Aprobada",
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/20",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-500/30",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold",
  },
  RECHAZADA: {
    label: "Rechazada",
    bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
    textClass: "text-rose-700 dark:text-rose-300",
    borderClass: "border-rose-500/30",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold",
  },
  CUMPLIDA: {
    label: "Cumplida / Entregada",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-500/30",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold",
  },
  CANCELADA: {
    label: "Cancelada",
    bgClass: "bg-zinc-500/10 dark:bg-zinc-500/20",
    textClass: "text-zinc-700 dark:text-zinc-400",
    borderClass: "border-zinc-500/30",
    badgeClass: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/30 font-medium",
  },
};

export function getCaseStatusConfig(status: string): StatusStyleConfig {
  return CASE_STATUS_CONFIG[status] || {
    label: status,
    bgClass: "bg-slate-500/10",
    textClass: "text-slate-700 dark:text-slate-300",
    borderClass: "border-slate-500/30",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  };
}

export function getPriorityConfig(priority: string): StatusStyleConfig {
  return PRIORITY_CONFIG[priority] || {
    label: priority,
    bgClass: "bg-slate-500/10",
    textClass: "text-slate-700 dark:text-slate-300",
    borderClass: "border-slate-500/30",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  };
}

export function getOrderStatusConfig(status: string): StatusStyleConfig {
  return ORDER_STATUS_CONFIG[status] || {
    label: status,
    bgClass: "bg-slate-500/10",
    textClass: "text-slate-700 dark:text-slate-300",
    borderClass: "border-slate-500/30",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  };
}
