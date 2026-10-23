import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PROGRAM_TO_COLUMN: Record<string, string> = Object.fromEntries(PADRON_PROGRAMS.map((p) => [p.label, p.column]));

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
    const modo = (searchParams.get("modo") || "interseccion").toLowerCase();

    const requestedProgs = programasParam.split("||").map((p) => p.trim()).filter(Boolean);

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
