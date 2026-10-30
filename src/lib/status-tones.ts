// Colores de las insignias de estado. Cada color quiere decir siempre lo mismo en toda la app:
//   green  = está bien o terminó bien (aprobada, vigente, disponible, activo, entregado)
//   blue   = abierto o en marcha
//   amber  = espera algo de alguien (pendiente, en revisión, de licencia)
//   orange = prioridad alta o por vencer
//   red    = urgente, rechazado, vencido o fuera de servicio
//   violet = pasó a otra área o está en uso
//   slate  = cerrado, cancelado o sin novedad
// Sin acceso a la base: se usa en pantalla y en el servidor.

export type StatusTone = "green" | "blue" | "amber" | "orange" | "red" | "violet" | "slate";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:text-blue-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:text-amber-300",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:border-orange-400/30 dark:text-orange-300",
  red: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:text-rose-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:text-violet-300",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:border-slate-400/25 dark:text-slate-300",
};

export const CASE_STATUS_TONE: Record<string, StatusTone> = {
  ABIERTO: "blue",
  EN_PROCESO: "amber",
  PENDIENTE: "amber",
  DERIVADO: "violet",
  CERRADO: "slate",
};

export const PRIORITY_TONE: Record<string, StatusTone> = {
  URGENTE: "red",
  ALTA: "orange",
  MEDIA: "slate",
  BAJA: "slate",
};

export const ORDER_STATUS_TONE: Record<string, StatusTone> = {
  BORRADOR: "slate",
  PENDIENTE_APROBACION: "amber",
  APROBADA: "blue",
  RECHAZADA: "red",
  CUMPLIDA: "green",
  CANCELADA: "slate",
};

export const DERIVATION_STATUS_TONE: Record<string, StatusTone> = {
  PENDIENTE: "amber",
  ACEPTADA: "green",
  RECHAZADA: "red",
  COMPLETADA: "slate",
};

export const AGREEMENT_STATUS_TONE: Record<string, StatusTone> = {
  EN_REVISION: "amber",
  VIGENTE: "green",
  VENCIDO: "red",
  RESCINDIDO: "slate",
  FINALIZADO: "slate",
};

export const VEHICLE_STATUS_TONE: Record<string, StatusTone> = {
  DISPONIBLE: "green",
  EN_TALLER: "orange",
  FUERA_DE_SERVICIO: "red",
};

export const RESERVATION_STATUS_TONE: Record<string, StatusTone> = {
  PENDIENTE: "amber",
  APROBADA: "blue",
  RECHAZADA: "red",
  EN_CURSO: "violet",
  FINALIZADA: "green",
  CANCELADA: "slate",
};

export const HR_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVO: "green",
  LICENCIA: "amber",
  VACACIONES: "blue",
  BAJA: "slate",
};

export const DELIVERY_STATUS_TONE: Record<string, StatusTone> = {
  SIN_PEDIDO: "slate",
  PENDIENTE: "amber",
  PARCIAL: "orange",
  ENTREGADO: "green",
};

export const CURSO_ESTADO_TONE: Record<string, StatusTone> = {
  ABIERTO: "blue",
  TERMINADO: "slate",
};

export const statusToneClass = (tone: StatusTone | undefined | null) => STATUS_TONE_CLASS[tone ?? "slate"];

/** El color de un estado según su lista; si no está, gris. */
export const toneOf = (map: Record<string, StatusTone>, status?: string | null): StatusTone =>
  (status && map[status]) || "slate";

/** Prioridad de las fichas de la emergencia climática (ahí "Alta" es lo más urgente). */
export const STORM_PRIORITY_TONE: Record<string, StatusTone> = {
  ALTA: "red",
  MEDIA: "amber",
  BAJA: "slate",
};

/** Insumos de la emergencia: si alcanza lo que hay en el depósito. */
export const STORM_STOCK_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  CRITICO: { label: "No alcanza", tone: "red" },
  CORRECTO: { label: "Alcanza", tone: "green" },
  EXCESO: { label: "Sobra", tone: "blue" },
};

export const RECORRIDA_ESTADO_TONE: Record<string, StatusTone> = {
  PLANIFICADA: "blue",
  HECHA: "green",
};
