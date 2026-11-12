// "Deshacer" (idea 141): después de cerrar un expediente, marcar una tarea como hecha, dar de baja de un
// programa o marcar todos los avisos como leídos, aparece unos segundos un botón para volver atrás.
// Sin base de datos, para poder probarlo solo.

/** Cuánto se ve el aviso con el botón "Deshacer". */
export const UNDO_TOAST_MS = 10_000;

/**
 * Hasta cuándo acepta el servidor deshacer. Es más largo que el aviso para que una conexión lenta
 * no lo haga fallar, pero corto para que no sirva para cambiar la historia después.
 */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;

/** Si algo hecho en `doneAt` todavía se puede deshacer en `now`. */
export function withinUndoWindow(doneAt: Date, now: Date = new Date()): boolean {
  const elapsed = now.getTime() - doneAt.getTime();
  // Un poco de margen hacia atrás por si los relojes no coinciden.
  return elapsed >= -5_000 && elapsed <= UNDO_WINDOW_MS;
}

/** Cómo queda en Auditoría una acción que se deshizo: la entrada no se borra, cambia de nombre. */
export const UNDONE_ACTIONS = {
  CLOSE_CASE: "CLOSE_CASE_DESHECHO",
  PADRON_PROGRAMA_BAJA: "PADRON_PROGRAMA_BAJA_DESHECHA",
} as const;

/** Como mucho, cuántos avisos se vuelven a dejar sin leer de una vez. */
export const UNDO_NOTICES_MAX = 500;

export const UNDO_TOO_LATE = "Ya pasó el momento de deshacerlo.";
