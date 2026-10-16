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
] as const;

export type PadronProgramColumn = (typeof PADRON_PROGRAMS)[number]["column"];

export function findPadronProgram(column: string) {
  return PADRON_PROGRAMS.find((p) => p.column === column);
}
