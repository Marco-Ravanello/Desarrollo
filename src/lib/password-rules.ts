// Reglas para la contraseña que elige cada persona. Sin acceso a la base: se usa en pantalla y en el servidor.

export const PASSWORD_MIN_LENGTH = 8;

/** Devuelve qué le falta a la contraseña nueva, o null si está bien. */
export function newPasswordProblem(password: string, opts: { current?: string; email?: string | null } = {}): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Tiene que tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (!/[a-záéíóúñ]/i.test(password) || !/\d/.test(password)) return "Tiene que tener letras y números.";
  if (opts.current && password === opts.current) return "Tiene que ser distinta de la actual.";
  const user = opts.email?.split("@")[0]?.toLowerCase();
  if (user && user.length >= 4 && password.toLowerCase().includes(user)) return "No puede contener tu usuario.";
  return null;
}
