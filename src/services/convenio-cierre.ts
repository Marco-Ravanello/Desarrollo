import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { AGREEMENT_REASON_MAX } from "@/lib/convenios";
import {
  LUGARES, canClosePeriod, canReopenPeriod, canViewCostDetail, horasTexto, parseDia, periodoDe, periodoTexto, valorHoraDel,
  type Lugar, type Periodo, type ResumenPeriodo,
} from "@/lib/convenio-gasto";
import { formatPesos } from "@/lib/formato";
import { actorFromDb, audit, getConvenioControl, getResumenPeriodo, getValoresHora, type ConvenioControl } from "@/services/convenio-gasto";

// Cierre de los períodos de un convenio por horas: cerrado, sus horas y su valor hora quedan fijos
// (lo revisa services/convenio-gasto.ts al cargar). Y la rendición del período para bajar en Excel.

type Actor = { id?: string | null };
type Result = { success: true } | { success: false; error: string };

const toDate = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);

export type PeriodoCerrado = {
  desde: string;
  hasta: string;
  horas: number;
  gastado: number;
  tope: number | null;
  cerradoPor: string | null;
  cerradoAt: Date;
};

export async function getPeriodosCerrados(agreementId: string): Promise<PeriodoCerrado[]> {
  const rows = await prisma.convenioPeriodoCerrado.findMany({ where: { agreementId }, orderBy: { desde: "desc" } });
  const ids = [...new Set(rows.map((r) => r.cerradoPorId).filter((x): x is string => Boolean(x)))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  return rows.map((r) => ({
    desde: isoDe(r.desde),
    hasta: isoDe(r.hasta),
    horas: Number(r.horas),
    gastado: Number(r.gastado),
    tope: r.tope === null ? null : Number(r.tope),
    cerradoPor: r.cerradoPorId ? users.find((u) => u.id === r.cerradoPorId)?.name ?? "Alguien" : null,
    cerradoAt: r.cerradoAt,
  }));
}

/** El período que empieza ese día, si es un comienzo de período válido del convenio. */
function periodoExacto(convenio: ConvenioControl, raw: unknown): Periodo | null {
  const dia = parseDia(raw);
  if (!dia) return null;
  const p = periodoDe(dia, convenio.periodStartDay ?? 1);
  return p.desde === dia ? p : null;
}

async function convenioParaCierre(user: Actor, agreementId: string, que: "cerrar" | "reabrir") {
  const actor = await actorFromDb(user);
  if (!actor) return { error: "Tu sesión expiró. Volvé a iniciar sesión." } as const;
  const convenio = await getConvenioControl(agreementId);
  if (!convenio) return { error: "No se encontró el convenio." } as const;
  if (convenio.costMode !== "POR_HORA") return { error: "Este convenio no tiene el control por horas." } as const;
  if (que === "cerrar" ? !canClosePeriod(actor, convenio) : !canReopenPeriod(actor.role)) {
    return {
      error: que === "cerrar"
        ? "Cierran el período la conducción y la dirección del área del convenio."
        : "Reabrir un período cerrado le corresponde a la conducción.",
    } as const;
  }
  return { actor, convenio } as const;
}

/**
 * Cierra un período ya terminado: guarda los totales y desde ahí no se cargan, corrigen ni borran horas
 * de esos días, ni cambia el valor hora que los paga.
 */
export async function cerrarPeriodo(user: Actor, agreementId: string, rawDesde: unknown, hoy = todayInArgentina()): Promise<Result> {
  const found = await convenioParaCierre(user, agreementId, "cerrar");
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, convenio } = found;
  const periodo = periodoExacto(convenio, rawDesde);
  if (!periodo) return { success: false, error: "Elegí un período del convenio." };
  if (hoy <= periodo.hasta) return { success: false, error: `El período termina el ${periodo.hasta.split("-").reverse().join("/")}: se cierra desde el día siguiente.` };

  const resumen = await prisma.$transaction(async (tx) => {
    // Exclusivo: espera a que termine cualquier carga de horas en curso y no deja empezar otra.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`convenio-cierre:${agreementId}`}))`;
    const ya = await tx.convenioPeriodoCerrado.findUnique({ where: { agreementId_desde: { agreementId, desde: toDate(periodo.desde) } } });
    if (ya) return "ya" as const;
    const r = await getResumenPeriodo(convenio, periodo, hoy);
    if (r.horasSinValor > 0) return r;
    await tx.convenioPeriodoCerrado.create({
      data: {
        agreementId,
        desde: toDate(periodo.desde),
        hasta: toDate(periodo.hasta),
        horas: r.horas,
        gastado: r.gastado,
        tope: r.tope,
        cerradoPorId: actor.id,
      },
    });
    return r;
  });
  if (resumen === "ya") return { success: false, error: "Ese período ya está cerrado." };
  if (resumen.horasSinValor > 0) {
    return { success: false, error: `Hay ${horasTexto(resumen.horasSinValor)} sin valor hora en el período. Cargá el valor hora antes de cerrarlo.` };
  }
  await audit(actor.id, "CONVENIO_PERIODO_CIERRE", agreementId, {
    periodo: periodoTexto(periodo),
    horas: resumen.horas,
    total: formatPesos(resumen.gastado),
  });
  return { success: true };
}

/** Reabre un período cerrado (la conducción), con motivo. Los totales se vuelven a calcular al cerrarlo de nuevo. */
export async function reabrirPeriodo(user: Actor, agreementId: string, rawDesde: unknown, rawMotivo: unknown): Promise<Result> {
  const found = await convenioParaCierre(user, agreementId, "reabrir");
  if ("error" in found) return { success: false, error: found.error! };
  const desde = parseDia(rawDesde);
  if (!desde) return { success: false, error: "Elegí el período." };
  const motivo = (typeof rawMotivo === "string" ? rawMotivo : "").trim().replace(/\s+/g, " ");
  if (motivo.length < 3) return { success: false, error: "Escribí por qué se reabre." };
  if (motivo.length > AGREEMENT_REASON_MAX) return { success: false, error: `El motivo puede tener hasta ${AGREEMENT_REASON_MAX} letras.` };
  const cerrado = await prisma.convenioPeriodoCerrado.findUnique({ where: { agreementId_desde: { agreementId, desde: toDate(desde) } } });
  if (!cerrado) return { success: false, error: "Ese período no está cerrado." };
  await prisma.convenioPeriodoCerrado.delete({ where: { id: cerrado.id } });
  await audit(found.actor.id, "CONVENIO_PERIODO_REAPERTURA", agreementId, {
    periodo: periodoTexto({ desde, hasta: isoDe(cerrado.hasta) }),
    total: formatPesos(Number(cerrado.gastado)),
    motivo,
  });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Rendición
// ---------------------------------------------------------------------------

export type Rendicion = {
  convenio: ConvenioControl;
  periodo: Periodo;
  resumen: ResumenPeriodo;
  cierre: PeriodoCerrado | null;
  valores: { desde: string; valor: number }[];
  detalle: {
    fecha: string;
    cuidadora: string;
    dni: string;
    nombre: string | null;
    horas: number;
    valorHora: number | null;
    importe: number | null;
    lugar: string;
    observacion: string | null;
  }[];
  nnya: Map<string, { ingreso: string; egreso: string | null }>;
};

/** Todo lo del período para la planilla de rendición (quien ve el detalle del convenio). */
export async function getRendicion(
  user: Actor & { role?: string | null; areaId?: string | null },
  agreementId: string,
  rawDesde: unknown,
  hoy = todayInArgentina()
): Promise<{ ok: true; data: Rendicion } | { ok: false; status: number; error: string }> {
  const actor = await actorFromDb(user);
  if (!actor) return { ok: false, status: 401, error: "Tu sesión expiró." };
  const convenio = await getConvenioControl(agreementId);
  if (!convenio || convenio.costMode !== "POR_HORA") return { ok: false, status: 404, error: "No se encontró el control del convenio." };
  if (!canViewCostDetail(actor, convenio)) return { ok: false, status: 403, error: "No tenés acceso al detalle de este convenio." };
  const periodo = periodoExacto(convenio, rawDesde) ?? periodoDe(hoy, convenio.periodStartDay ?? 1);

  const [resumen, valores, filas, cerrados, nnya] = await Promise.all([
    getResumenPeriodo(convenio, periodo, hoy),
    getValoresHora(agreementId),
    prisma.convenioHora.findMany({
      where: { agreementId, fecha: { gte: toDate(periodo.desde), lte: toDate(periodo.hasta) } },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
      include: { cuidadora: { select: { nombre: true } } },
    }),
    getPeriodosCerrados(agreementId),
    prisma.convenioNnya.findMany({ where: { agreementId }, select: { dni: true, ingreso: true, egreso: true } }),
  ]);
  return {
    ok: true,
    data: {
      convenio,
      periodo,
      resumen,
      cierre: cerrados.find((c) => c.desde === periodo.desde) ?? null,
      valores: valores.filter((v) => v.desde <= periodo.hasta).map(({ desde, valor }) => ({ desde, valor })),
      detalle: filas.map((f) => {
        const fecha = isoDe(f.fecha);
        const valorHora = valorHoraDel(fecha, valores);
        const lugar = LUGARES[f.lugar as Lugar] ?? f.lugar;
        return {
          fecha,
          cuidadora: f.cuidadora.nombre,
          dni: f.dni,
          nombre: f.nombre,
          horas: Number(f.horas),
          valorHora,
          importe: valorHora === null ? null : Math.round(Number(f.horas) * valorHora * 100) / 100,
          lugar: f.lugarDetalle ? `${lugar} (${f.lugarDetalle})` : lugar,
          observacion: f.observacion,
        };
      }),
      nnya: new Map(nnya.map((n) => [n.dni, { ingreso: isoDe(n.ingreso), egreso: n.egreso ? isoDe(n.egreso) : null }])),
    },
  };
}
