import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { periodoTexto } from "@/lib/convenio-gasto";
import { formatFechaHora } from "@/lib/fechas";
import { getRendicion } from "@/services/convenio-cierre";

export const dynamic = "force-dynamic";

const dma = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

function hoja(rows: Record<string, string | number | null>[], anchos: number[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = anchos.map((wch) => ({ wch }));
  return ws;
}

/**
 * La rendición de un período de un convenio por horas, en Excel: resumen, por día, el detalle de cada fila,
 * por cuidadora y por NNyA. Tiene datos de NNyA: pide el permiso de bajar datos personales y queda en Auditoría.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!hasPermission(session.user.role, PERMISSIONS.EXPORT_PERSONAL_DATA)) {
    return NextResponse.json({ error: "Tu rol no tiene permiso para bajar datos personales." }, { status: 403 });
  }
  const { id } = await params;
  const periodoPedido = new URL(request.url).searchParams.get("periodo");
  const res = await getRendicion(session.user, id, periodoPedido);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { convenio, periodo, resumen, cierre, valores, detalle, nnya } = res.data;

  const resumenRows: (string | number | null)[][] = [
    ["Rendición del convenio"],
    [],
    ["Convenio", convenio.title],
    ["Número", convenio.number ?? "Sin número"],
    ["Área", convenio.area?.name ?? "Sin área"],
    ["Período", periodoTexto(periodo)],
    [
      "Estado del período",
      cierre
        ? `Cerrado el ${formatFechaHora(cierre.cerradoAt)}${cierre.cerradoPor ? ` por ${cierre.cerradoPor}` : ""}`
        : "Abierto: los números pueden cambiar (rendición parcial)",
    ],
    [],
    ["Horas", resumen.horas],
    ["Gastado ($)", resumen.gastado],
    ["Tope ($)", resumen.tope],
    ["Disponible ($)", resumen.disponible],
    ["Usado (%)", resumen.porcentaje === null ? null : Math.round(resumen.porcentaje * 10) / 10],
    ["Días con horas", resumen.porDia.length],
    ["Cuidadoras", resumen.porCuidadora.length],
    ["NNyA acompañados", resumen.porNnya.length],
    [],
    ["Valor hora", "Desde"],
    ...valores.map((v) => [v.valor, dma(v.desde)]),
  ];
  if (resumen.horasSinValor > 0) resumenRows.push([], ["Atención", `${resumen.horasSinValor} horas sin valor hora: no están en el gastado.`]);
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  wsResumen["!cols"] = [{ wch: 22 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      resumen.porDia.map((d) => ({ Día: dma(d.fecha), Horas: d.horas, "Importe ($)": d.importe, "Acumulado ($)": d.acumulado })),
      [12, 10, 16, 16]
    ),
    "Por día"
  );
  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      detalle.map((f) => ({
        Día: dma(f.fecha),
        Cuidadora: f.cuidadora,
        "DNI NNyA": f.dni,
        NNyA: f.nombre ?? "",
        Horas: f.horas,
        "Valor hora ($)": f.valorHora,
        "Importe ($)": f.importe,
        Lugar: f.lugar,
        Observación: f.observacion ?? "",
      })),
      [12, 24, 12, 30, 8, 14, 14, 26, 40]
    ),
    "Detalle"
  );
  XLSX.utils.book_append_sheet(
    wb,
    hoja(resumen.porCuidadora.map((c) => ({ Cuidadora: c.nombre, Horas: c.horas, "Importe ($)": c.importe })), [28, 10, 16]),
    "Por cuidadora"
  );
  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      resumen.porNnya.map((n) => {
        const ficha = nnya.get(n.dni);
        return {
          DNI: n.dni,
          NNyA: n.nombre ?? "",
          Ingreso: dma(ficha?.ingreso ?? null),
          Egreso: dma(ficha?.egreso ?? null),
          Días: n.dias,
          Horas: n.horas,
          "Importe ($)": n.importe,
        };
      }),
      [12, 30, 12, 12, 8, 10, 16]
    ),
    "Por NNyA"
  );

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CONVENIO_RENDICION",
      entity: "Agreement",
      entityId: id,
      details: JSON.stringify({ periodo: periodoTexto(periodo), filas: detalle.length }),
    },
  });

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const nombre = `rendicion_${(convenio.number ?? convenio.title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "_").slice(0, 40)}_${periodo.desde}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
