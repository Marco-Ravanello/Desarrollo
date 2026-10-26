import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { programFromSlug, programSlug } from "@/lib/padron-programs";
import { getProgramPeopleForExport } from "@/services/programs";

export const dynamic = "force-dynamic";

const cell = (value: string | null | undefined) => `"${(value ?? "").replace(/"/g, '""')}"`;
const dayText = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "");

/** La lista de personas de un programa, para abrir en Excel. Queda anotado en Auditoría. */
export async function GET(_request: Request, { params }: { params: Promise<{ programa: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!hasPermission(session.user.role, PERMISSIONS.EXPORT_PERSONAL_DATA)) {
    return NextResponse.json({ error: "Tu rol no tiene permiso para bajar datos personales." }, { status: 403 });
  }
  const program = programFromSlug((await params).programa);
  if (!program) return NextResponse.json({ error: "No se encontró el programa." }, { status: 404 });

  const rows = await getProgramPeopleForExport(program.column);
  const lines = [
    ["DNI", "Apellido y nombre", "Dirección", "Barrio", "Localidad", "Teléfono", "Email", "En el programa desde"].join(";"),
    ...rows.map((r) =>
      [cell(r.dni), cell(r.nombre_completo), cell(r.direccion), cell(r.barrio), cell(r.localidad), cell(r.telefono), cell(r.email), cell(dayText(r.desde))].join(";")
    ),
  ];

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "EXPORT_CSV",
      entity: "Programa",
      entityId: program.column,
      details: `Bajó la lista de ${program.label} (${rows.length} personas).`,
    },
  });

  return new Response("﻿" + lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="programa_${programSlug(program.column)}.csv"`,
    },
  });
}
