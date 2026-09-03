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

    const requestedProgs = programasParam.split("||").map((p) => p.trim()).filter(Boolean);

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

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, telefono, direccion, email
       FROM padron_unificado
       WHERE ${whereClause}
       ORDER BY cantidad_programas DESC
       LIMIT 5000;`
    );

    const headers = ["DNI", "Nombre Completo", "Cantidad Programas", "Programas Activos", "Roles", "Barrio", "Localidad", "Telefono", "Direccion", "Email"];
    const csvRows = [headers.join(";")];

    rows.forEach((r: any) => {
      const line = [
        `"${r.dni || ""}"`,
        `"${(r.nombre_completo || "").replace(/"/g, '""')}"`,
        r.cantidad_programas || 0,
        `"${(r.programas_activos || "").replace(/"/g, '""')}"`,
        `"${(r.roles || "").replace(/"/g, '""')}"`,
        `"${(r.barrio || "").replace(/"/g, '""')}"`,
        `"${(r.localidad || "").replace(/"/g, '""')}"`,
        `"${(r.telefono || "").replace(/"/g, '""')}"`,
        `"${(r.direccion || "").replace(/"/g, '""')}"`,
        `"${(r.email || "").replace(/"/g, '""')}"`
      ];
      csvRows.push(line.join(";"));
    });

    const bom = "\uFEFF";
    const csvContent = bom + csvRows.join("\r\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cruce_programas_3f_${Date.now()}.csv"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
