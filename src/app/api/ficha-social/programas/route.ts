import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";

export const dynamic = "force-dynamic";

const PROGRAMAS_CATALOGO = [
  { id: "prog_centro_de_familia", nombre: "Centro de Familia", area: "Desarrollo Humano", descripcion: "Acompañamiento integral, talleres familiares y apoyo psicosocial" },
  { id: "prog_tarjeta_alimentar", nombre: "Tarjeta Alimentar", area: "Desarrollo Social", descripcion: "Asignación universal por hijo y módulo alimentario de emergencia" },
  { id: "prog_jardines_municipales", nombre: "Jardines Municipales", area: "Educación y Primera Infancia", descripcion: "Inscripción en jardines de infantes y maternales municipales" },
  { id: "prog_colonias_municipales_2026", nombre: "Colonias Municipales 2026", area: "Deportes", descripcion: "Actividades recreativas y deportivas de verano en polideportivos" },
  { id: "prog_colonias_barrios_populares_2026", nombre: "Colonias Barrios Populares 2026", area: "Desarrollo Humano", descripcion: "Colonias barriales en villas y asentamientos de Tres de Febrero" },
  { id: "prog_centro_de_formacion_profesional_3f", nombre: "Centro de Formación Profesional 3F", area: "Producción y Empleo", descripcion: "Cursos de oficio, capacitación laboral y formación técnica" },
  { id: "prog_intervenciones_desarrollo_humano", nombre: "Intervenciones Desarrollo Humano", area: "Desarrollo Humano", descripcion: "Seguimiento de situaciones de vulnerabilidad y asistencia directa" },
  { id: "prog_prestaciones_desarrollo_humano", nombre: "Prestaciones Desarrollo Humano", area: "Desarrollo Humano", descripcion: "Entrega de alimentos (AAD), membrana, frazadas y materiales" },
  { id: "prog_tarjeta_mas_familia", nombre: "Tarjeta Más Familia", area: "Desarrollo Social", descripcion: "Subsidio municipal complementario para compras de primera necesidad" },
  { id: "prog_escuelas_municipales_emac_emmu_capacyt", nombre: "Escuelas Municipales (EMAC, EMMU, CAPACYT)", area: "Cultura", descripcion: "Formación artística, música, danza y artes plásticas" },
  { id: "prog_espacios_de_educacion_no_formal_udis_apoyos_becas_envion", nombre: "Espacios de Educación No Formal (UDIs, Apoyos, Becas, Envión)", area: "Educación", descripcion: "Unidades de Desarrollo Infantil y becas de apoyo escolar" },
  { id: "prog_curso_de_arbitros_deportes", nombre: "Curso de Árbitros (Deportes)", area: "Deportes", descripcion: "Capacitación deportiva para arbitraje en ligas locales" },
  { id: "prog_gimnasio_municipal_deportes", nombre: "Gimnasio Municipal (Deportes)", area: "Deportes", descripcion: "Pases y entrenamiento físico en gimnasios municipales" },
  { id: "prog_natacion_municipal_deportes", nombre: "Natación Municipal (Deportes)", area: "Deportes", descripcion: "Clases y pileta libre en natatorios municipales" },
  { id: "prog_servicios_locales_de_ninez_caseros_el_libertador_derqui", nombre: "Servicios Locales de Niñez (Caseros, El Libertador, Derqui)", area: "Protección de Derechos", descripcion: "Intervenciones de protección integral y seguimiento infanto-juvenil" },
  { id: "prog_programa_envion_edla_evita_el_libertador", nombre: "Programa Envión (EDLA, Evita, El Libertador)", area: "Juventud y Empleo", descripcion: "Inclusión formativa, laboral y becas para jóvenes de 12 a 21 años" },
  { id: "prog_comedores_comunitarios_programa_fosc", nombre: "Comedores Comunitarios (Programa FOSC)", area: "Desarrollo Social", descripcion: "Asistencia y módulos a comedores y merenderos barriales" },
  { id: "prog_emergencia_climatica", nombre: "Emergencia climática", area: "Desarrollo Humano y Hábitat", descripcion: "Familias relevadas en las fichas de tormenta de la contingencia climática" }
];

/** Cuántas personas del padrón tiene cada programa (una sola consulta, columna por columna). */
async function countPeoplePerProgram(): Promise<Record<string, number>> {
  const columns = PADRON_PROGRAMS.map((p) => p.column).filter((c) => /^[a-z0-9_]+$/.test(c));
  if (columns.length === 0) return {};
  const rows = await prisma.$queryRawUnsafe<Record<string, number>[]>(
    `SELECT ${columns.map((c) => `COUNT(*) FILTER (WHERE "${c}" = 1)::int AS "${c}"`).join(", ")} FROM padron_unificado;`
  );
  return rows[0] ?? {};
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Si la cuenta falla se devuelve el catálogo sin números (antes se mostraba un 1.200 inventado).
  const counts = await countPeoplePerProgram().catch((err) => {
    console.error("No se pudo contar las personas por programa:", err);
    return {} as Record<string, number>;
  });
  return NextResponse.json(
    PROGRAMAS_CATALOGO.map((p) => ({ ...p, total_personas: typeof counts[p.id] === "number" ? counts[p.id] : null }))
  );
}
