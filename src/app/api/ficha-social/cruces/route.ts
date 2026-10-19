import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";

export const dynamic = "force-dynamic";

const PROGRAM_TO_COLUMN: Record<string, string> = Object.fromEntries(PADRON_PROGRAMS.map((p) => [p.label, p.column]));

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
      if (col && /^[a-zA-Z0-9_]+$/.test(col)) columns.push(col);
    });

    let whereClause = "1=1";
    if (columns.length > 0) {
      if (modo === "union") {
        whereClause = `(${columns.map((c) => `"${c}" = 1`).join(" OR ")})`;
      } else {
        whereClause = `(${columns.map((c) => `"${c}" = 1`).join(" AND ")})`;
      }
    }

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
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, telefono, direccion
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
