import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) return NextResponse.json([]);

    const isNumeric = /^\d+$/.test(q);
    let rows: any[] = [];

    if (isNumeric) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT dni, nombre_completo, programas_activos FROM padron_unificado
         WHERE dni LIKE $1
         ORDER BY cantidad_programas DESC
         LIMIT 8;`,
        `%${q}%`
      );
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT dni, nombre_completo, programas_activos FROM padron_unificado
         WHERE LOWER(nombre_completo) LIKE $1
         ORDER BY cantidad_programas DESC
         LIMIT 8;`,
        `%${q.toLowerCase()}%`
      );
    }

    const suggestions = rows.map((r: any) => ({
      dni: r.dni,
      nombre: r.nombre_completo || "Sin nombre registrado",
      origen: (r.programas_activos || "Programas Sociales").split("|").slice(0, 2).join(" / ")
    }));

    return NextResponse.json(suggestions);
  } catch (error: any) {
    return NextResponse.json([]);
  }
}
