import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PROGRAM_TO_COLUMN: Record<string, string> = {
  "Centro de Familia": "prog_centro_de_familia",
  "Tarjeta Alimentar": "prog_tarjeta_alimentar",
  "Jardines Municipales": "prog_jardines_municipales",
  "Colonias Municipales 2026": "prog_colonias_municipales_2026",
  "Colonias Barrios Populares 2026": "prog_colonias_barrios_populares_2026",
  "Centro de Formación Profesional 3F": "prog_centro_de_formacion_profesional_3f",
  "Intervenciones Desarrollo Humano": "prog_intervenciones_desarrollo_humano",
  "Prestaciones Desarrollo Humano": "prog_prestaciones_desarrollo_humano",
  "Tarjeta Más Familia": "prog_tarjeta_mas_familia",
  "Escuelas Municipales (EMAC, EMMU, CAPACYT)": "prog_escuelas_municipales_emac_emmu_capacyt",
  "Espacios de Educación No Formal (UDIs, Apoyos, Becas, Envión)": "prog_espacios_de_educacion_no_formal_udis_apoyos_becas_envion",
  "Curso de Árbitros (Deportes)": "prog_curso_de_arbitros_deportes",
  "Gimnasio Municipal (Deportes)": "prog_gimnasio_municipal_deportes",
  "Natación Municipal (Deportes)": "prog_natacion_municipal_deportes",
  "Servicios Locales de Niñez (Caseros, El Libertador, Derqui)": "prog_servicios_locales_de_ninez_caseros_el_libertador_derqui",
  "Programa Envión (EDLA, Evita, El Libertador)": "prog_programa_envion_edla_evita_el_libertador",
  "Comedores Comunitarios (Programa FOSC)": "prog_comedores_comunitarios_programa_fosc"
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const programasParam = searchParams.get("programas") || "";
    const modo = (searchParams.get("modo") || "interseccion").toLowerCase();
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

    const requestedProgs = programasParam
      .split("||")
      .map((p) => p.trim())
      .filter(Boolean);

    const columns: string[] = [];
    requestedProgs.forEach((p) => {
      const col = PROGRAM_TO_COLUMN[p] || (Object.values(PROGRAM_TO_COLUMN).includes(p) ? p : null);
      if (col) columns.push(col);
    });

    let whereClause = "1=1";
    if (columns.length > 0) {
      if (modo === "union") {
        whereClause = `(${columns.map((c) => `${c} = 1`).join(" OR ")})`;
      } else {
        whereClause = `(${columns.map((c) => `${c} = 1`).join(" AND ")})`;
      }
    }

    if (q) {
      const cleanQ = q.replace(/'/g, "''");
      whereClause += ` AND (dni LIKE '%${cleanQ}%' OR LOWER(nombre_completo) LIKE '%${cleanQ.toLowerCase()}%' OR LOWER(barrio) LIKE '%${cleanQ.toLowerCase()}%')`;
    }

    const countResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM padron_unificado WHERE ${whereClause};`
    );
    const totalCoincidencias = countResult[0]?.total || 0;

    const barriosResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(NULLIF(barrio, ''), 'Sin Barrio Registrado') as barrio, COUNT(*)::int as cantidad
       FROM padron_unificado
       WHERE ${whereClause}
       GROUP BY barrio
       ORDER BY cantidad DESC
       LIMIT 8;`
    );

    const rowsResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, telefono, direccion
       FROM padron_unificado
       WHERE ${whereClause}
       ORDER BY cantidad_programas DESC, nombre_completo ASC
       LIMIT ${limit} OFFSET ${offset};`
    );

    const formattedRows = rowsResult.map((r: any) => ({
      dni: r.dni,
      nombre: r.nombre_completo || "Sin nombre",
      programas: (r.programas_activos || "").split("|").map((p: string) => p.trim()).filter(Boolean),
      cantidad_programas: r.cantidad_programas || 0,
      roles: { "General": r.roles || "Beneficiario" },
      contacto: {
        telefono: r.telefono || "N/R",
        direccion: r.direccion || "No especificada",
        barrio: r.barrio || "No especificado",
        localidad: r.localidad || "Tres de Febrero"
      }
    }));

    return NextResponse.json({
      total_coincidencias: totalCoincidencias,
      programas_consultados: requestedProgs,
      modo,
      limite: limit,
      offset,
      resultados: formattedRows,
      distribucion_barrios: barriosResult.map((b: any) => ({
        barrio: b.barrio,
        cantidad: b.cantidad
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ total_coincidencias: 0, resultados: [], error: error.message }, { status: 500 });
  }
}
