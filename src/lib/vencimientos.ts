// Avisos de vencimientos (VTV, seguro de los vehículos y fin de los convenios): cuándo se avisa y con qué texto.
// Sin base de datos, para poder probarlo solo.

import { diasEntre } from "@/lib/fechas";

export type ExpiryKind = "vtv" | "seguro" | "convenio";

/** Se avisa un mes antes, una semana antes y cuando ya venció. */
export type ExpiryStage = "mes" | "semana" | "vencido";

export const EXPIRY_NOTICE_DAYS = 30;

/** En qué aviso está un vencimiento ("AAAA-MM-DD") hoy, o null si todavía falta más de un mes. */
export function expiryStage(day: string, today: string): ExpiryStage | null {
  const left = diasEntre(today, day);
  if (left < 0) return "vencido";
  if (left <= 7) return "semana";
  if (left <= EXPIRY_NOTICE_DAYS) return "mes";
  return null;
}

const fecha = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

const WHAT: Record<ExpiryKind, { la: string; vence: string }> = {
  vtv: { la: "la VTV", vence: "vence" },
  seguro: { la: "el seguro", vence: "vence" },
  convenio: { la: "el convenio", vence: "termina" },
};

/**
 * El aviso para la campanita. El título cambia con cada etapa (así cada etapa se avisa una sola vez);
 * el mensaje dice la fecha y cuánto falta.
 */
export function expiryNotice(kind: ExpiryKind, label: string, day: string, today: string): { title: string; message: string } | null {
  const stage = expiryStage(day, today);
  if (!stage) return null;
  const { la, vence } = WHAT[kind];
  const left = diasEntre(today, day);
  const La = la.charAt(0).toUpperCase() + la.slice(1);
  if (stage === "vencido") {
    const venció = kind === "convenio" ? "Terminó" : "Venció";
    return {
      title: `${venció} ${la} de ${label}`,
      message: kind === "convenio"
        ? `Terminó el ${fecha(day)}. Si se renovó, actualizá la fecha; si no, cambiale el estado.`
        : `Venció el ${fecha(day)}. Cuando se renueve, cargá la fecha nueva en el vehículo.`,
    };
  }
  const cuando = left === 0 ? "hoy" : left === 1 ? "mañana" : `en ${left} días`;
  return {
    title: stage === "semana" ? `${La} de ${label} ${vence} esta semana` : `${La} de ${label} ${vence} este mes`,
    message: `${vence === "termina" ? "Termina" : "Vence"} el ${fecha(day)} (${cuando}).`,
  };
}

/** Qué se muestra de un vehículo en el Inicio: lo que venció primero, o lo próximo a vencer. */
export interface VehicleExpiryInfo {
  /** "VTV vencida el 10/10", "El seguro vence el 05/12", "VTV hasta 11/26" o "Sin vencimientos cargados". */
  text: string;
  /** La VTV o el seguro ya vencieron (va en rojo). */
  overdue: boolean;
  /** Vence en el próximo mes (va en naranja). */
  soon: boolean;
  /** El vencimiento más cercano ("AAAA-MM-DD"), o null si no hay ninguno cargado. */
  nearest: string | null;
}

const diaMes = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const mesAnio = (day: string) => `${day.slice(5, 7)}/${day.slice(2, 4)}`;

/** `vtv` y `seguro` en "AAAA-MM-DD" (o null si no están cargados). */
export function vehicleExpiryInfo(vtv: string | null, seguro: string | null, today: string): VehicleExpiryInfo {
  const vtvVencida = Boolean(vtv && diasEntre(today, vtv) < 0);
  const seguroVencido = Boolean(seguro && diasEntre(today, seguro) < 0);
  const fechas = [vtv, seguro].filter((d): d is string => Boolean(d)).sort();
  const nearest = fechas[0] ?? null;

  if (vtvVencida && seguroVencido) return { text: "VTV y seguro vencidos", overdue: true, soon: false, nearest };
  if (vtvVencida) return { text: `VTV vencida el ${diaMes(vtv!)}`, overdue: true, soon: false, nearest };
  if (seguroVencido) return { text: `Seguro vencido el ${diaMes(seguro!)}`, overdue: true, soon: false, nearest };
  if (!nearest) return { text: "Sin vencimientos cargados", overdue: false, soon: false, nearest };

  const esVtv = nearest === vtv;
  if (diasEntre(today, nearest) <= EXPIRY_NOTICE_DAYS) {
    return { text: `${esVtv ? "La VTV" : "El seguro"} vence el ${diaMes(nearest)}`, overdue: false, soon: true, nearest };
  }
  return { text: vtv ? `VTV hasta ${mesAnio(vtv)}` : `Seguro hasta ${mesAnio(seguro!)}`, overdue: false, soon: false, nearest };
}
