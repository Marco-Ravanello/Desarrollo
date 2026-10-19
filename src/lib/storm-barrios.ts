// Barrios y localidades que se eligen en la ficha de tormenta.
// La lista la definió el área; para sumar uno, agregarlo acá.

export const STORM_BARRIOS = [
  "Capitán Bermúdez",
  "Caseros",
  "Churruca",
  "Ciudad Jardín",
  "Ciudadela",
  "Derqui",
  "Ejército de los Andes",
  "Escalada",
  "Esperanza",
  "Evita",
  "Evita / Mercado",
  "Favelita",
  "José Ingenieros",
  "Libertador",
  "Loma Hermosa",
  "Los Rusos",
  "Maldonado",
  "Martín Coronado",
  "Matienzo",
  "Mercado",
  "Once de Septiembre",
  "Pablo Podestá",
  "Puerta 8",
  "Remedios de Escalada",
  "Sáenz Peña",
  "San Eduardo",
  "Santos Lugares",
  "Villa Bosch",
  "Villa Herminia",
  "Villa Raffo",
] as const;

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^barrio\s+/, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Devuelve el barrio de la lista que corresponde a un texto escrito a mano
 * (sin importar tildes ni mayúsculas), o null si no está en la lista.
 */
export function matchStormBarrio(value: string | null | undefined): string | null {
  if (!value) return null;
  const k = key(value);
  if (!k) return null;
  return STORM_BARRIOS.find((b) => key(b) === k) ?? null;
}
