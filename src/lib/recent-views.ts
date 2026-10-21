// "Vistos recientemente" del buscador: los últimos expedientes y personas que abrió cada usuario.
// En el navegador se guardan solo el tipo y el id (nada de nombres); los datos se piden al
// servidor al abrir el buscador, que vuelve a revisar los permisos.

export type RecentKind = "case" | "person";
export interface RecentRef {
  kind: RecentKind;
  id: string;
}

export const RECENT_MAX = 6;

const storageKey = (userId: string) => `vistos-recientes:${userId}`;

/** Agrega una visita adelante, sin repetir, y deja como mucho RECENT_MAX. */
export function pushRecent(list: RecentRef[], ref: RecentRef, max = RECENT_MAX): RecentRef[] {
  return [ref, ...list.filter((r) => !(r.kind === ref.kind && r.id === ref.id))].slice(0, max);
}

/** Lo que haya guardado, descartando cualquier cosa con otra forma. */
export function parseRecent(raw: unknown): RecentRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is RecentRef =>
        !!r &&
        (r.kind === "case" || r.kind === "person") &&
        typeof r.id === "string" &&
        r.id.length > 0 &&
        r.id.length <= 64
    )
    .slice(0, RECENT_MAX);
}

export function readRecent(userId: string | undefined): RecentRef[] {
  if (!userId) return [];
  try {
    return parseRecent(JSON.parse(localStorage.getItem(storageKey(userId)) || "[]"));
  } catch {
    return [];
  }
}

export function rememberRecent(userId: string | undefined, ref: RecentRef) {
  if (!userId || !ref.id) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(pushRecent(readRecent(userId), ref)));
  } catch {}
}

/** Saca un elemento que ya no existe o que el usuario no puede ver. */
export function forgetRecent(userId: string | undefined, keep: RecentRef[]) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(keep));
  } catch {}
}
