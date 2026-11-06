/**
 * Pedido de clave temporal desde la pantalla de ingreso (idea 106). Reglas sin base de datos.
 *
 * Quien se olvidó la contraseña escribe su usuario y toca "Pedir clave temporal". Si la cuenta
 * existe y está activa, el Superadmin recibe un aviso en la campana y ve el pedido arriba de la
 * lista de Usuarios, con el botón "Clave temporal". La pantalla de ingreso responde siempre lo
 * mismo, exista o no el usuario, para no mostrar qué usuarios hay.
 */

/** Una misma cuenta no vuelve a avisar hasta pasada una hora. */
export const PASSWORD_HELP_COOLDOWN_MS = 60 * 60 * 1000;

/** Como mucho tantos pedidos nuevos por hora entre todas las cuentas, para que nadie llene la campana. */
export const PASSWORD_HELP_MAX_PER_HOUR = 10;

/** Los pedidos de más de una semana ya no se muestran. */
export const PASSWORD_HELP_SHOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Lo que dice la pantalla de ingreso, siempre igual. */
export const PASSWORD_HELP_REPLY =
  "Listo. Si el usuario está bien escrito, el Superadmin recibe el aviso y te pasa una clave temporal.";

/** El usuario que escribió la persona, limpio. Vacío si no sirve. */
export function cleanHelpIdentifier(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (v.length < 2 || v.length > 120) return "";
  return v;
}

/** ¿Esta cuenta puede avisar de nuevo? (Nunca pidió, o el último pedido tiene más de una hora.) */
export function canRequestAgain(lastRequest: Date | null | undefined, now: Date): boolean {
  return !lastRequest || now.getTime() - lastRequest.getTime() >= PASSWORD_HELP_COOLDOWN_MS;
}

/** ¿El pedido se sigue mostrando en Usuarios? */
export function isHelpRequestVisible(requestedAt: Date | null | undefined, now: Date): boolean {
  return Boolean(requestedAt) && now.getTime() - requestedAt!.getTime() < PASSWORD_HELP_SHOW_MS;
}

/** Texto del aviso al Superadmin. */
export function passwordHelpNotice(user: { name?: string | null; username?: string | null; email?: string | null }) {
  const who = user.name?.trim() || user.username || user.email || "Una persona";
  const account = user.username ? ` (usuario ${user.username})` : "";
  return {
    title: `${who} pidió una clave temporal`,
    message: `${who}${account} no puede entrar a la app y pidió una clave temporal desde la pantalla de ingreso.`,
    link: "/admin/users#pedidos-de-clave",
  };
}
