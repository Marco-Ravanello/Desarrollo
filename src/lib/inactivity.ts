// Cierre de sesión por inactividad. Por defecto a los 30 minutos sin usar la app;
// se puede cambiar con la variable NEXT_PUBLIC_INACTIVITY_MINUTES (en minutos, puede tener decimales).

const configured = Number(process.env.NEXT_PUBLIC_INACTIVITY_MINUTES);
const minutes = Number.isFinite(configured) && configured > 0 ? configured : 30;

export const INACTIVITY_LIMIT_MS = Math.round(minutes * 60 * 1000);
/** Cuánto antes del cierre aparece el aviso (un minuto, o la mitad del tiempo si el límite es muy corto). */
export const INACTIVITY_WARNING_MS = Math.min(60 * 1000, Math.round(INACTIVITY_LIMIT_MS / 2));

export function idleStateAt(now: number, lastActivity: number, limitMs = INACTIVITY_LIMIT_MS, warningMs = INACTIVITY_WARNING_MS) {
  const remainingMs = Math.max(0, limitMs - (now - lastActivity));
  return { expired: remainingMs === 0, warning: remainingMs > 0 && remainingMs <= warningMs, remainingMs };
}
