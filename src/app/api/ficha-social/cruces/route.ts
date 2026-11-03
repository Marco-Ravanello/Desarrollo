import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { COLUMNAS_DE_PROGRAMAS_SQL, columnasDelCruce, condicionDelCruce, parseModoCruce, programasDeLaFila } from "@/lib/cruces";
import { nombrePropio } from "@/lib/nombres";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const programasParam = searchParams.get("programas") || "";
    const modo = parseModoCruce(searchParams.get("modo"));
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

    const requestedProgs = programasParam
      .split("||")
      .map((p) => p.trim())
      .filter(Boolean);

    // Columnas de la lista fija de programas; en "Exclusión" la primera es el programa base.
    const columns = columnasDelCruce(requestedProgs);
    let whereClause = condicionDelCruce(columns, modo);

    const params: any[] = [];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      whereClause += ` AND (LOWER(dni) LIKE $${params.length} OR LOWER(nombre_completo) LIKE $${params.length} OR LOWER(barrio) LIKE $${params.length})`;
    }

    const countResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM padron_unificado WHERE ${whereClause};`,
      ...params
    );
    const totalCoincidencias = countResult[0]?.total || 0;

    const barriosResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(NULLIF(barrio, ''), 'Sin Barrio Registrado') as barrio, COUNT(*)::int as cantidad
       FROM padron_unificado
       WHERE ${whereClause}
       GROUP BY barrio
       ORDER BY cantidad DESC
       LIMIT 8;`,
      ...params
    );

    const rowsResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, telefono, direccion, ${COLUMNAS_DE_PROGRAMAS_SQL}
       FROM padron_unificado
       WHERE ${whereClause}
       ORDER BY cantidad_programas DESC, nombre_completo ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2};`,
      ...params,
      limit,
      offset
    );

    const formattedRows = rowsResult.map((r: any) => ({
      dni: r.dni,
      nombre: nombrePropio(r.nombre_completo) || "Sin nombre",
      programas: programasDeLaFila(r),
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
