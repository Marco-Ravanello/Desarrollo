// Nombre de usuario para ingresar a la app: corto, en minúsculas, sin espacios ni tildes.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
const ALLOWED = /^[a-z0-9][a-z0-9._-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Qué le falta al nombre de usuario, o null si está bien. */
export function usernameProblem(value: unknown): string | null {
  const u = normalizeUsername(value);
  if (!u) return "Escribí el nombre de usuario.";
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) return `El usuario tiene que tener entre ${USERNAME_MIN} y ${USERNAME_MAX} letras.`;
  if (!ALLOWED.test(u)) return "El usuario solo puede tener letras sin tilde, números, punto, guion o guion bajo, y sin espacios.";
  return null;
}

/** Sugerencia a partir del nombre: "María José Pérez" → "maria.perez". */
export function suggestUsername(fullName: string): string {
  const words = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const pick = words.length === 1 ? words : [words[0], words[words.length - 1]];
  return pick.join(".").slice(0, USERNAME_MAX);
}

/** El correo es opcional; si se escribe, tiene que parecer un correo. Devuelve null si está vacío. */
export function normalizeEmail(value: unknown): { ok: true; email: string | null } | { ok: false; error: string } {
  const e = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!e) return { ok: true, email: null };
  if (!EMAIL.test(e)) return { ok: false, error: "El correo no parece válido." };
  return { ok: true, email: e };
}
