import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { columnasDelCruce, condicionDelCruce, parseModoCruce } from "@/lib/cruces";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as any, PERMISSIONS.EXPORT_PERSONAL_DATA)) {
    return NextResponse.json({ error: "Tu rol no tiene permiso para bajar datos personales." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const programasParam = searchParams.get("programas") || "";
    const modo = parseModoCruce(searchParams.get("modo"));

    const requestedProgs = programasParam.split("||").map((p) => p.trim()).filter(Boolean);

    // Columnas de la lista fija de programas; en "Exclusión" la primera es el programa base.
    const columns = columnasDelCruce(requestedProgs);
    const whereClause = condicionDelCruce(columns, modo);

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, telefono, direccion, email
       FROM padron_unificado
       WHERE ${whereClause}
       ORDER BY cantidad_programas DESC
       LIMIT 5000;`
    );

    const headers = ["DNI", "Nombre Completo", "Cantidad Programas", "Programas activos", "Roles", "Barrio", "Localidad", "Telefono", "Direccion", "Email"];
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

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "EXPORT_CSV",
        entity: "PadronUnificado",
        entityId: "cruce_programas",
        details: `Exportación CSV de ${rows.length} registros (modo ${modo}; programas: ${requestedProgs.join(", ") || "todos"})`,
      },
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
