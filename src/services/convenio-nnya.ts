import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { canLoadHours, parseEgreso } from "@/lib/convenio-gasto";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { actorFromDb, audit, getConvenioControl } from "@/services/convenio-gasto";

// Cada NNyA de un convenio por horas: ingreso (su primer día con horas, lo lleva services/convenio-gasto.ts),
// egreso con motivo, y el expediente con el que se sigue. Lo manejan quienes cargan horas.

type Actor = { id?: string | null };
type Result = { success: true } | { success: false; error: string };

const toDate = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const dma = (iso: string) => iso.split("-").reverse().join("/");

const CASE_OPEN = (status: string) => status !== "CERRADO";

export type ExpedienteOpcion = { id: string; title: string; area: string; abierto: boolean };

export type NnyaDelConvenio = {
  id: string;
  dni: string;
  nombre: string | null;
  ingreso: string;
  egreso: string | null;
  motivoEgreso: string | null;
  ultimoDia: string | null;
  horas: number;
  /** El expediente vinculado, si quien mira lo puede ver (los de violencia de género, solo con permiso). */
  expediente: ExpedienteOpcion | null;
  /** Hay un expediente vinculado que quien mira no puede ver: no se muestra ni se cambia. */
  expedienteReservado: boolean;
  opciones: ExpedienteOpcion[];
};

/** Los NNyA del convenio, los que siguen primero. Con sus expedientes para elegir. */
export async function getNnyaDelConvenio(user: { role?: string | null }, agreementId: string): Promise<NnyaDelConvenio[]> {
  const canSensitive = hasPermission(user.role as never, PERMISSIONS.VIEW_SENSITIVE_CASES);
  const rows = await prisma.convenioNnya.findMany({
    where: { agreementId },
    include: { case: { select: { id: true, title: true, status: true, area: { select: { name: true } } } } },
  });
  if (rows.length === 0) return [];
  const dnis = rows.map((r) => r.dni);
  const [totales, casos] = await Promise.all([
    prisma.convenioHora.groupBy({ by: ["dni"], where: { agreementId, dni: { in: dnis } }, _sum: { horas: true }, _max: { fecha: true } }),
    prisma.case.findMany({
      where: { person: { dni: { in: dnis } } },
      select: { id: true, title: true, status: true, area: { select: { name: true } }, person: { select: { dni: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const visible = (c: { area: { name: string } }) => canSensitive || !isSensitiveArea(c.area.name);
  const opcion = (c: { id: string; title: string; status: string; area: { name: string } }): ExpedienteOpcion => ({
    id: c.id,
    title: c.title,
    area: c.area.name,
    abierto: CASE_OPEN(c.status),
  });

  return rows
    .map((r) => {
      const t = totales.find((x) => x.dni === r.dni);
      const reservado = Boolean(r.case && !visible(r.case));
      return {
        id: r.id,
        dni: r.dni,
        nombre: r.nombre,
        ingreso: isoDe(r.ingreso),
        egreso: r.egreso ? isoDe(r.egreso) : null,
        motivoEgreso: r.motivoEgreso,
        ultimoDia: t?._max.fecha ? isoDe(t._max.fecha) : null,
        horas: Number(t?._sum.horas ?? 0),
        expediente: r.case && !reservado ? opcion(r.case) : null,
        expedienteReservado: reservado,
        opciones: casos.filter((c) => c.person?.dni === r.dni && visible(c)).map(opcion),
      };
    })
    .sort((a, b) => Number(Boolean(a.egreso)) - Number(Boolean(b.egreso)) || (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni, "es"));
}

async function nnyaPara(user: Actor, agreementId: string, nnyaId: string) {
  const actor = await actorFromDb(user);
  if (!actor) return { error: "Tu sesión expiró. Volvé a iniciar sesión." } as const;
  const convenio = await getConvenioControl(agreementId);
  if (!convenio) return { error: "No se encontró el convenio." } as const;
  if (!canLoadHours(actor, convenio)) return { error: "Lo cambian la conducción y las personas del área del convenio." } as const;
  const nnya = await prisma.convenioNnya.findFirst({ where: { id: nnyaId, agreementId } });
  if (!nnya) return { error: "No se encontró a ese niño, niña o adolescente en este convenio. Recargá la página." } as const;
  return { actor, convenio, nnya } as const;
}

/** Egreso: desde ese día no se le cargan horas y deja de contar para la proyección. */
export async function registrarEgreso(user: Actor, agreementId: string, nnyaId: string, raw: Record<string, unknown>, hoy = todayInArgentina()): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  const parsed = parseEgreso(raw, isoDe(nnya.ingreso), hoy);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { fecha, motivo } = parsed.data;
  const despues = await prisma.convenioHora.findFirst({
    where: { agreementId, dni: nnya.dni, fecha: { gt: toDate(fecha) } },
    orderBy: { fecha: "desc" },
    select: { fecha: true },
  });
  if (despues) {
    return { success: false, error: `Tiene horas cargadas hasta el ${dma(isoDe(despues.fecha))}: el egreso tiene que ser ese día o después.` };
  }
  await prisma.convenioNnya.update({ where: { id: nnyaId }, data: { egreso: toDate(fecha), motivoEgreso: motivo } });
  await audit(actor.id, "CONVENIO_NNYA_EGRESO", agreementId, { dni: nnya.dni, fecha: dma(fecha), motivo });
  return { success: true };
}

/** Volvió: se borra el egreso y se le pueden volver a cargar horas. El egreso anterior queda en Auditoría. */
export async function volvioAIngresar(user: Actor, agreementId: string, nnyaId: string): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  if (!nnya.egreso) return { success: false, error: "No tiene egreso cargado." };
  await prisma.convenioNnya.update({ where: { id: nnyaId }, data: { egreso: null, motivoEgreso: null } });
  await audit(actor.id, "CONVENIO_NNYA_REINGRESO", agreementId, { dni: nnya.dni, desde: dma(isoDe(nnya.egreso)) });
  return { success: true };
}

/** Vincula (o desvincula, con null) el expediente del NNyA. Solo uno de sus expedientes que quien lo hace pueda ver. */
export async function vincularExpediente(user: Actor & { role?: string | null }, agreementId: string, nnyaId: string, caseId: string | null): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  const canSensitive = hasPermission(actor.role, PERMISSIONS.VIEW_SENSITIVE_CASES);
  if (nnya.caseId && !canSensitive) {
    const actual = await prisma.case.findUnique({ where: { id: nnya.caseId }, select: { area: { select: { name: true } } } });
    if (actual && isSensitiveArea(actual.area.name)) return { success: false, error: "No tenés permiso para cambiar este vínculo." };
  }
  if (caseId) {
    const c = await prisma.case.findFirst({
      where: { id: caseId, person: { dni: nnya.dni } },
      select: { id: true, area: { select: { name: true } } },
    });
    if (!c || (!canSensitive && isSensitiveArea(c.area.name))) return { success: false, error: "Elegí uno de sus expedientes." };
  }
  await prisma.convenioNnya.update({ where: { id: nnyaId }, data: { caseId } });
  await audit(actor.id, "CONVENIO_NNYA_EXPEDIENTE", agreementId, { dni: nnya.dni, estado: caseId ? "Vinculado a un expediente" : "Sin expediente" });
  return { success: true };
}
