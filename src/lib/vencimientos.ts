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
