// Localidades del partido de Tres de Febrero, para elegir en "Cargar persona" y "Editar datos".
// La lista que se ofrece suma también las que ya aparecen escritas en el padrón.

export const LOCALIDADES_3F = [
  "Caseros",
  "Churruca",
  "Ciudad Jardín Lomas del Palomar",
  "Ciudadela",
  "El Libertador",
  "El Palomar",
  "José Ingenieros",
  "Loma Hermosa",
  "Martín Coronado",
  "Once de Septiembre",
  "Pablo Podestá",
  "Remedios de Escalada",
  "Sáenz Peña",
  "Santos Lugares",
  "Villa Bosch",
  "Villa Raffo",
] as const;

export interface AddressOptions {
  localidades: string[];
  barrios: string[];
}

/** Junta dos listas sin repetir (sin importar tildes ni mayúsculas) y las ordena. */
export function mergeOptions(base: readonly string[], extra: string[]): string[] {
  const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const seen = new Map<string, string>();
  for (const v of [...base, ...extra]) {
    const t = (v || "").trim();
    if (t && !seen.has(key(t))) seen.set(key(t), t);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "es"));
}
