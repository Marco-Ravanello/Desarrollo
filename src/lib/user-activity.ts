// Último ingreso de cada usuario, para ver cuentas que nadie usa.
import { diaAR, diasEntre, formatFecha, formatFechaHora } from "@/lib/fechas";

/** Una cuenta activa sin entrar hace estos días o más se marca como "sin uso". */
export const UNUSED_ACCOUNT_DAYS = 60;

export interface LastLoginInfo {
  /** "Hoy", "Ayer", "Hace 5 días" o la fecha. */
  label: string;
  /** Fecha y hora exacta, o desde cuándo se registran los ingresos si nunca entró. */
  title: string;
  days: number | null;
  unused: boolean;
}

/**
 * lastLogin: último ingreso registrado. createdAt: alta de la cuenta.
 * loginsSince: el ingreso más viejo registrado en la app; antes de esa fecha no hay datos, así que no se cuenta como "sin uso".
 */
export function lastLoginInfo(
  lastLogin: Date | string | null,
  createdAt: Date | string,
  loginsSince: Date | string | null,
  now = new Date()
): LastLoginInfo {
  const today = diaAR(now);
  if (lastLogin) {
    const days = diasEntre(diaAR(lastLogin), today);
    const label = days <= 0 ? "Hoy" : days === 1 ? "Ayer" : days < 30 ? `Hace ${days} días` : formatFecha(lastLogin);
    return { label, title: `${formatFechaHora(lastLogin)} hs`, days, unused: days >= UNUSED_ACCOUNT_DAYS };
  }
  // Nunca entró (o entró antes de que se registraran los ingresos): se cuenta desde lo más reciente de las dos fechas.
  const desde = loginsSince && new Date(loginsSince) > new Date(createdAt) ? loginsSince : createdAt;
  const days = diasEntre(diaAR(desde), today);
  return {
    label: "Sin ingresos",
    title: `Sin ingresos registrados desde el ${formatFecha(desde)}`,
    days: null,
    unused: days >= UNUSED_ACCOUNT_DAYS,
  };
}
