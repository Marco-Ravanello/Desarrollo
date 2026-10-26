// Programas del padrón unificado: cada uno tiene su columna (prog_...) en
// padron_unificado, con 1 si la persona participa. Para sumar un programa nuevo
// hace falta agregar su columna con una migración y sumarlo acá.

export const PADRON_PROGRAMS = [
  { label: "Centro de Familia", column: "prog_centro_de_familia" },
  { label: "Tarjeta Alimentar", column: "prog_tarjeta_alimentar" },
  { label: "Jardines Municipales", column: "prog_jardines_municipales" },
  { label: "Colonias Municipales 2026", column: "prog_colonias_municipales_2026" },
  { label: "Colonias Barrios Populares 2026", column: "prog_colonias_barrios_populares_2026" },
  { label: "Centro de Formación Profesional 3F", column: "prog_centro_de_formacion_profesional_3f" },
  { label: "Intervenciones Desarrollo Humano", column: "prog_intervenciones_desarrollo_humano" },
  { label: "Prestaciones Desarrollo Humano", column: "prog_prestaciones_desarrollo_humano" },
  { label: "Tarjeta Más Familia", column: "prog_tarjeta_mas_familia" },
  { label: "Escuelas Municipales (EMAC, EMMU, CAPACYT)", column: "prog_escuelas_municipales_emac_emmu_capacyt" },
  { label: "Espacios de Educación No Formal (UDIs, Apoyos, Becas, Envión)", column: "prog_espacios_de_educacion_no_formal_udis_apoyos_becas_envion" },
  { label: "Curso de Árbitros (Deportes)", column: "prog_curso_de_arbitros_deportes" },
  { label: "Gimnasio Municipal (Deportes)", column: "prog_gimnasio_municipal_deportes" },
  { label: "Natación Municipal (Deportes)", column: "prog_natacion_municipal_deportes" },
  { label: "Servicios Locales de Niñez (Caseros, El Libertador, Derqui)", column: "prog_servicios_locales_de_ninez_caseros_el_libertador_derqui" },
  { label: "Programa Envión (EDLA, Evita, El Libertador)", column: "prog_programa_envion_edla_evita_el_libertador" },
  { label: "Comedores Comunitarios (Programa FOSC)", column: "prog_comedores_comunitarios_programa_fosc" },
  // Se marca sola al cargar una ficha de tormenta (Emergencia climática).
  { label: "Emergencia climática", column: "prog_emergencia_climatica" },
] as const;

export type PadronProgramColumn = (typeof PADRON_PROGRAMS)[number]["column"];

export function findPadronProgram(column: string) {
  return PADRON_PROGRAMS.find((p) => p.column === column);
}

export function isPadronProgramColumn(column: unknown): column is PadronProgramColumn {
  return typeof column === "string" && PADRON_PROGRAMS.some((p) => p.column === column);
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * La columna de un programa a partir de su nombre. Las columnas se armaron con el nombre de cada programa
 * sin tildes ni signos ("Curso de Árbitros (Deportes)" → prog_curso_de_arbitros_deportes), así que el
 * nombre que figura en el padrón o en una participación lleva siempre a su columna. Null si no es de la lista.
 */
export function programColumnFor(name: string | null | undefined): PadronProgramColumn | null {
  const raw = (name ?? "").trim();
  if (!raw) return null;
  const byLabel = PADRON_PROGRAMS.find((p) => p.label.toLowerCase() === raw.toLowerCase());
  if (byLabel) return byLabel.column;
  const slug = "prog_" + stripAccents(raw).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return isPadronProgramColumn(slug) ? slug : null;
}

/** Los programas de `programas_activos` ("A | B | C") como lista. */
export function splitProgramList(list: string | null | undefined): string[] {
  return (list ?? "").split("|").map((p) => p.trim()).filter(Boolean);
}

/** Suma el programa a `programas_activos` si no estaba (con cualquier forma de escribirlo). */
export function addProgramToList(list: string | null | undefined, column: PadronProgramColumn): string {
  const items = splitProgramList(list);
  if (items.some((p) => programColumnFor(p) === column)) return items.join(" | ");
  return [...items, findPadronProgram(column)!.label].join(" | ");
}

/** Saca el programa de `programas_activos` (con cualquier forma de escribirlo); null si queda vacío. */
export function removeProgramFromList(list: string | null | undefined, column: PadronProgramColumn): string | null {
  const items = splitProgramList(list).filter((p) => programColumnFor(p) !== column);
  return items.length ? items.join(" | ") : null;
}
