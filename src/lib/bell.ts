// Cada cuánto pregunta y revisa la campanita (idea 130). Sin base de datos, para poder probarlo solo.

/** Mientras la pestaña está a la vista, la campanita pregunta por avisos nuevos cada un minuto. */
export const BELL_POLL_MS = 60 * 1000;

/** Al volver a una pestaña que estuvo escondida, pregunta enseguida si la última vez fue hace más de esto. */
export const BELL_REFRESH_ON_VISIBLE_MS = 15 * 1000;

/** Seguimientos de hoy y vencimientos se revisan como mucho cada 30 minutos por persona (no en cada pregunta). */
export const NOTICES_RECHECK_MS = 30 * 60 * 1000;

/** Hasta qué momento la última revisión se considera vieja: antes de esto, toca revisar de nuevo. */
export const noticesRecheckCutoff = (now: Date) => new Date(now.getTime() - NOTICES_RECHECK_MS);

/** Si la campanita tiene que preguntar ahora: solo con la pestaña a la vista y si ya pasó el tiempo. */
export function shouldPollBell(opts: { visible: boolean; lastFetchAt: number; now: number; minGapMs?: number }): boolean {
  if (!opts.visible) return false;
  return opts.now - opts.lastFetchAt >= (opts.minGapMs ?? BELL_POLL_MS);
}
