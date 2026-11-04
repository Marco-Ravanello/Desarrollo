import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AWAY_STATUSES, canEditHR, isAwayStatus } from "@/lib/hr-labels";
import { diaAR } from "@/lib/fechas";
import {
  dateToDay, dayToDate, kindForStatus, leaveDays, leaveKindLabel, leavesOverlap, readLeaveInput, spansInMonth, statusForLeave,
  type AbsenceSpan,
} from "@/lib/hr-leaves";

// Licencias y vacaciones del personal: el historial de cada agente y el calendario de ausencias del mes.
// La situación del legajo (Activo, Licencia, Vacaciones) acompaña a la licencia que cubre el día de hoy.

type Actor = { id?: string | null; role?: string | null };
type Result = { success: true } | { success: false; error: string };

const NO_PERMISSION = "Solo Superadmin y Administración General cargan licencias.";
const todayUTC = (now = new Date()) => dayToDate(diaAR(now))!;
const fmt = (d: Date) => dateToDay(d).split("-").reverse().join("/");

/** El historial de un agente, de la más nueva a la más vieja. */
export async function getLeavesFor(hrRecordId: string) {
  return prisma.hRLeave.findMany({
    where: { hrRecordId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, kind: true, startDate: true, endDate: true, notes: true, createdAt: true },
  });
}

/** Registra una licencia. Si cubre el día de hoy, el legajo pasa a "Licencia" o "Vacaciones" hasta su último día. */
export async function registerLeave(
  user: Actor,
  hrRecordId: string,
  input: { kind?: string | null; startDate?: string | null; endDate?: string | null; notes?: string | null },
  now = new Date()
): Promise<Result> {
  if (!user.id || !canEditHR(user.role)) return { success: false, error: NO_PERMISSION };
  const parsed = readLeaveInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const leave = parsed.data;

  const record = await prisma.hRRecord.findUnique({ where: { id: hrRecordId }, select: { id: true, firstName: true, lastName: true, status: true } });
  if (!record) return { success: false, error: "No se encontró ese legajo." };

  const clash = await prisma.hRLeave.findFirst({
    where: { hrRecordId, startDate: { lte: leave.endDate }, endDate: { gte: leave.startDate } },
    select: { kind: true, startDate: true, endDate: true },
  });
  if (clash) {
    return {
      success: false,
      error: `Se pisa con otra licencia ya cargada (${leaveKindLabel(clash.kind)}, del ${fmt(clash.startDate)} al ${fmt(clash.endDate)}).`,
    };
  }

  const today = todayUTC(now);
  const coversToday = leave.startDate <= today && leave.endDate >= today;
  await prisma.$transaction(async (tx) => {
    await tx.hRLeave.create({ data: { ...leave, hrRecordId, createdById: user.id } });
    if (coversToday && record.status !== "BAJA") {
      await tx.hRRecord.update({ where: { id: hrRecordId }, data: { status: statusForLeave(leave.kind), statusUntil: leave.endDate } });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id!,
        action: "HR_LICENCIA",
        entity: "HRRecord",
        entityId: hrRecordId,
        details: `${record.lastName}, ${record.firstName}: ${leaveKindLabel(leave.kind)} del ${fmt(leave.startDate)} al ${fmt(leave.endDate)} (${leaveDays(leave.startDate, leave.endDate)} días).`,
      },
    });
  });
  return { success: true };
}

/** Borra una licencia cargada por error. Si era la de hoy, el legajo vuelve a "Activo". */
export async function deleteLeave(user: Actor, leaveId: string, now = new Date()): Promise<Result> {
  if (!user.id || !canEditHR(user.role)) return { success: false, error: NO_PERMISSION };
  const leave = await prisma.hRLeave.findUnique({
    where: { id: leaveId },
    include: { hrRecord: { select: { id: true, firstName: true, lastName: true, status: true, statusUntil: true } } },
  });
  if (!leave) return { success: false, error: "Esa licencia ya no está. Recargá la página." };
  const today = todayUTC(now);
  const r = leave.hrRecord;
  const wasToday =
    leave.startDate <= today &&
    leave.endDate >= today &&
    isAwayStatus(r.status) &&
    r.statusUntil?.getTime() === leave.endDate.getTime();
  await prisma.$transaction(async (tx) => {
    await tx.hRLeave.delete({ where: { id: leaveId } });
    if (wasToday) await tx.hRRecord.update({ where: { id: r.id }, data: { status: "ACTIVO", statusUntil: null } });
    await tx.auditLog.create({
      data: {
        userId: user.id!,
        action: "HR_LICENCIA_BORRADA",
        entity: "HRRecord",
        entityId: r.id,
        details: `${r.lastName}, ${r.firstName}: borró ${leaveKindLabel(leave.kind)} del ${fmt(leave.startDate)} al ${fmt(leave.endDate)}.`,
      },
    });
  });
  return { success: true };
}

/**
 * Cuando el legajo se guarda "de licencia" o "de vacaciones" con fecha "hasta", y no hay ninguna licencia
 * cargada para hoy, la agrega al historial desde hoy hasta ese día. Así el historial no se queda sin ella.
 */
export async function ensureLeaveForStatus(
  hrRecordId: string,
  status: string,
  statusUntil: Date | null,
  userId: string | null,
  now = new Date(),
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  if (!isAwayStatus(status) || !statusUntil) return false;
  const today = todayUTC(now);
  if (statusUntil < today) return false;
  const existing = await db.hRLeave.findFirst({
    where: { hrRecordId, startDate: { lte: statusUntil }, endDate: { gte: today } },
    select: { id: true },
  });
  if (existing) return false;
  await db.hRLeave.create({
    data: {
      hrRecordId,
      kind: kindForStatus(status),
      startDate: today,
      endDate: statusUntil,
      notes: "Cargada desde la situación del legajo.",
      createdById: userId,
    },
  });
  return true;
}

/**
 * "Ya volvió" antes de tiempo: la licencia de hoy termina ayer. Si había empezado hoy, se borra
 * (no llegó a faltar). Se llama dentro de la misma transacción que pasa el legajo a Activo.
 */
export async function cutLeaveCoveringToday(db: Prisma.TransactionClient, hrRecordId: string, now = new Date()) {
  const today = todayUTC(now);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const current = await db.hRLeave.findMany({ where: { hrRecordId, startDate: { lte: today }, endDate: { gte: today } }, select: { id: true, startDate: true } });
  for (const l of current) {
    if (l.startDate > yesterday) await db.hRLeave.delete({ where: { id: l.id } });
    else await db.hRLeave.update({ where: { id: l.id }, data: { endDate: yesterday } });
  }
}

export type AbsenceRow = {
  id: string;
  name: string;
  area: string | null;
  spans: AbsenceSpan[];
  /** Figura de licencia o vacaciones sin licencia cargada en el historial (legajos de antes). */
  fromStatus: boolean;
};

/**
 * El calendario de ausencias del mes: una fila por agente que falta algún día, con sus tramos.
 * Los legajos que figuran de licencia sin licencia cargada (de antes del historial) se muestran desde hoy.
 */
export async function getAbsencesForMonth(year: number, month: number, areaId?: string | null, now = new Date()): Promise<AbsenceRow[]> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const areaWhere = areaId ? { areaId } : {};
  const records = await prisma.hRRecord.findMany({
    where: {
      ...areaWhere,
      OR: [
        { leaves: { some: { startDate: { lte: last }, endDate: { gte: first } } } },
        { status: { in: [...AWAY_STATUSES] } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      statusUntil: true,
      area: { select: { name: true } },
      leaves: { where: { startDate: { lte: last }, endDate: { gte: first } }, select: { id: true, kind: true, notes: true, startDate: true, endDate: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const today = todayUTC(now);
  const rows: AbsenceRow[] = [];
  for (const r of records) {
    const spans = spansInMonth(r.leaves, year, month);
    let fromStatus = false;
    if (isAwayStatus(r.status) && today >= first && today <= last) {
      const until = r.statusUntil && r.statusUntil >= today ? r.statusUntil : r.statusUntil ? null : last;
      const covered = r.leaves.some((l) => leavesOverlap(l, { startDate: today, endDate: today }));
      if (until && !covered) {
        spans.push(...spansInMonth([{ id: `estado-${r.id}`, kind: kindForStatus(r.status), notes: null, startDate: today, endDate: until }], year, month));
        fromStatus = true;
      }
    }
    if (spans.length === 0) continue;
    rows.push({ id: r.id, name: `${r.lastName}, ${r.firstName}`, area: r.area?.name ?? null, spans: spans.sort((a, b) => a.from - b.from), fromStatus });
  }
  return rows;
}

/**
 * La situación sale sola del historial cuando arranca una licencia: el legajo que está Activo (o de licencia
 * con la fecha de vuelta ya pasada) pasa a Licencia, Licencia sin goce o Vacaciones hasta el último día.
 * La vuelta a Activo no es automática: hay que confirmar que la persona volvió ("Ya volvió").
 * Se llama al abrir Recursos Humanos, un legajo, Ausencias del mes o el Inicio. Devuelve cuántos cambió.
 */
export async function syncLeaveStatuses(now = new Date()): Promise<number> {
  const today = todayUTC(now);
  const current = await prisma.hRLeave.findMany({
    where: { startDate: { lte: today }, endDate: { gte: today }, hrRecord: { status: { not: "BAJA" } } },
    select: { kind: true, endDate: true, hrRecord: { select: { id: true, status: true, statusUntil: true } } },
    orderBy: { endDate: "desc" },
  });
  let changed = 0;
  const seen = new Set<string>();
  for (const l of current) {
    const r = l.hrRecord;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const stale = r.status === "ACTIVO" || (isAwayStatus(r.status) && (!r.statusUntil || r.statusUntil < today));
    if (!stale) continue;
    const { count } = await prisma.hRRecord.updateMany({
      where: { id: r.id, status: r.status },
      data: { status: statusForLeave(l.kind), statusUntil: l.endDate },
    });
    changed += count;
  }
  return changed;
}

/** Los que figuran de licencia o vacaciones con la fecha de vuelta ya pasada: falta confirmar que volvieron. */
export const pendingReturnWhere = (now = new Date()) => ({ status: { in: [...AWAY_STATUSES] }, statusUntil: { lt: todayUTC(now) } });

/** La licencia más reciente que ya empezó (la que explica la situación de hoy). */
export async function getCurrentLeave(hrRecordId: string, now = new Date()) {
  return prisma.hRLeave.findFirst({
    where: { hrRecordId, startDate: { lte: todayUTC(now) } },
    orderBy: { endDate: "desc" },
    select: { kind: true, startDate: true, endDate: true },
  });
}
