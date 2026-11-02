/**
 * Nombres para mostrar. El padrón trae muchos nombres en mayúsculas ("GÓMEZ, MARÍA"): en pantalla
 * se muestran con mayúscula inicial ("Gómez, María"). Solo cambia lo que se ve; lo guardado queda igual.
 * Si el nombre ya tiene minúsculas, se respeta como está (alguien lo escribió así a propósito).
 */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos", "di", "van", "von"]);

function capitalizar(palabra: string): string {
  if (!palabra) return palabra;
  return palabra.charAt(0).toLocaleUpperCase("es-AR") + palabra.slice(1);
}

export function nombrePropio<T extends string | null | undefined>(texto: T): T {
  if (!texto) return texto;
  const s = texto as string;
  // Solo se tocan los que están todos en mayúsculas.
  if (s !== s.toLocaleUpperCase("es-AR") || s === s.toLocaleLowerCase("es-AR")) return texto;
  let primera = true;
  const out = s
    .toLocaleLowerCase("es-AR")
    .replace(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?/gu, (palabra) => {
      const esPrimera = primera;
      primera = false;
      if (!esPrimera && PARTICULAS.has(palabra)) return palabra;
      // O'NEILL -> O'Neill, D'ALESSANDRO -> D'Alessandro
      return palabra
        .split(/(['’])/)
        .map((parte) => (parte === "'" || parte === "’" ? parte : capitalizar(parte)))
        .join("");
    });
  return out as T;
}

/** "GÓMEZ, MARÍA" y "MARÍA" / "GÓMEZ" por separado, para las fichas que guardan nombre y apellido aparte. */
export function personaPropia<P extends { firstName?: string | null; lastName?: string | null }>(p: P): P {
  return { ...p, firstName: nombrePropio(p.firstName), lastName: nombrePropio(p.lastName) };
}
