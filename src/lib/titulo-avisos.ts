// Contador de avisos sin leer en la pestaña del navegador: "(3) Inicio · MuniGestión 3F".

const PREFIJO = /^\(\d+\+?\)\s+/;

/** El título de la página con el contador adelante (o sin él, si no hay avisos sin leer). */
export function tituloConAvisos(titulo: string, sinLeer: number): string {
  const base = titulo.replace(PREFIJO, "");
  if (!Number.isFinite(sinLeer) || sinLeer <= 0) return base;
  const n = sinLeer > 99 ? "99+" : String(Math.floor(sinLeer));
  return `(${n}) ${base}`;
}
