import { condicionBusquedaSql } from "@/lib/search-text";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { nombrePropio } from "@/lib/nombres";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
      // Sin importar tildes ni el orden de las palabras.
      const palabras = condicionBusquedaSql("texto_busqueda", q, 1);
      rows = await prisma.$queryRawUnsafe(
        `SELECT dni, nombre_completo, programas_activos FROM padron_unificado
         WHERE ${palabras.sql}
         ORDER BY cantidad_programas DESC
         LIMIT 8;`,
        ...palabras.params
      );
    }

    const suggestions = rows.map((r: any) => ({
      dni: r.dni,
      nombre: nombrePropio(r.nombre_completo) || "Sin nombre registrado",
      origen: (r.programas_activos || "Programas Sociales").split("|").slice(0, 2).join(" / ")
    }));

    return NextResponse.json(suggestions);
  } catch (error: any) {
    return NextResponse.json([]);
  }
}
