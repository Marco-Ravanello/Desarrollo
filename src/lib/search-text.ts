/**
 * Búsqueda sin tildes ni orden de las palabras (idea 103).
 *
 * "gomez maria", "María Gómez" y "GOMEZ, MARIA" encuentran a la misma persona: el texto buscado
 * se pasa a mayúsculas sin tildes ni signos, se parte en palabras y cada palabra tiene que aparecer
 * en lo guardado (pasado por la misma regla), en cualquier orden.
 *
 * La base usa la misma regla en la función SQL texto_sin_tildes() (migración
 * 20261106200000_busqueda_sin_tildes) y en la columna padron_unificado.texto_busqueda.
 */

/** Como mucho tantas palabras por búsqueda (las demás no se tienen en cuenta). */
export const MAX_SEARCH_WORDS = 6;

const ACCENTS = /[̀-ͯ]/g;

/** "Pérez-López, Juan" -> "PEREZ LOPEZ JUAN". Igual que texto_sin_tildes() en la base. */
export function normalizarBusqueda(texto?: string | null): string {
  return (texto || "")
    .normalize("NFD")
    .replace(ACCENTS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Palabras a buscar, sin repetir. Cada una puede estar en cualquier parte ("ANA" encuentra a "ANALIA"). */
export function palabrasDeBusqueda(texto?: string | null): string[] {
  const words = normalizarBusqueda(texto).split(" ").filter(Boolean);
  return Array.from(new Set(words)).slice(0, MAX_SEARCH_WORDS);
}

/** Patrones LIKE ("%GOMEZ%") de cada palabra. Solo quedan letras y números, así que no hay comodines sueltos. */
export function patronesDeBusqueda(texto?: string | null): string[] {
  return palabrasDeBusqueda(texto).map((w) => `%${w}%`);
}

/** ¿El texto guardado tiene todas las palabras buscadas? (Para filtrar en memoria con la misma regla.) */
export function coincideBusqueda(guardado: string | null | undefined, buscado: string): boolean {
  const words = palabrasDeBusqueda(buscado);
  if (!words.length) return true;
  const target = normalizarBusqueda(guardado);
  return words.every((w) => target.includes(w));
}

/**
 * Condición SQL para $queryRawUnsafe con parámetros numerados: cada palabra en `column`
 * (una expresión ya normalizada, por ejemplo texto_busqueda o texto_sin_tildes(x)).
 * Devuelve el texto de la condición y los valores, empezando en $`startIdx`.
 */
export function condicionBusquedaSql(column: string, texto: string, startIdx: number): { sql: string; params: string[] } {
  const params = patronesDeBusqueda(texto);
  if (!params.length) return { sql: "TRUE", params: [] };
  const sql = params.map((_, i) => `${column} LIKE $${startIdx + i}`).join(" AND ");
  return { sql: `(${sql})`, params };
}
