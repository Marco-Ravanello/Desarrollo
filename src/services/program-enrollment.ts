import prisma from "@/lib/prisma";
import type { PadronUnificado, Prisma } from "@prisma/client";
import { canManageProgramEnrollment } from "@/lib/permissions";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { canManageProgram } from "@/lib/program-ownership";
import { getProgramOwners, programManageError } from "@/services/programs";
import {
  PADRON_PROGRAMS, addProgramToList, findPadronProgram, isPadronProgramColumn, programColumnFor, removeProgramFromList, splitProgramList,
  type PadronProgramColumn,
} from "@/lib/padron-programs";

// Altas y bajas de una persona en un programa del padrón desde su ficha. El estado de hoy sigue
// en padron_unificado (la columna prog_..., programas_activos y cantidad_programas, que usan el
// mapa, los cruces y la ficha); cada movimiento queda en padron_movimientos con fecha y quién lo hizo.

type Actor = { id?: string | null; role?: string | null };
type Result = { success: true } | { success: false; error: string };

export const PROGRAM_NOTE_MAX = 300;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" → medianoche UTC de ese día (así se guardan las fechas sin hora). */
function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

const dayText = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

function checkDay(day: string | undefined | null): { day: string } | { error: string } {
  const value = (day ?? "").trim() || todayInArgentina();
  if (!ISO_DAY.test(value) || Number.isNaN(dayToDate(value).getTime())) return { error: "Elegí una fecha válida." };
  if (value > todayInArgentina()) return { error: "La fecha no puede ser posterior a hoy." };
  if (value < "1990-01-01") return { error: "Revisá la fecha: es muy vieja." };
  return { day: value };
}

/** La fila del padrón bloqueada hasta que termine la operación (dos altas a la vez no se pisan). */
async function lockPadronRow(tx: Prisma.TransactionClient, dni: string): Promise<PadronUnificado | null> {
  const rows = await tx.$queryRaw<{ dni: string }[]>`SELECT dni FROM padron_unificado WHERE dni = ${dni} FOR UPDATE`;
  if (!rows.length) return null;
  return tx.padronUnificado.findUnique({ where: { dni } });
}

export function isInProgram(row: Pick<PadronUnificado, "programas_activos"> & Record<string, unknown>, column: PadronProgramColumn) {
  return row[column] === 1 || splitProgramList(row.programas_activos).some((p) => programColumnFor(p) === column);
}

/**
 * Da de alta a la persona en el programa. Si todavía no está en el padrón pero sí en el Registro Único,
 * se la suma al padrón con esos datos.
 */
export async function enrollInProgram(
  user: Actor,
  input: { dni: string; column: string; day?: string | null; note?: string | null }
): Promise<Result> {
  if (!user.id || !canManageProgramEnrollment(user.role)) return { success: false, error: "Tu rol no puede dar altas en los programas." };
  const dni = (input.dni ?? "").trim();
  if (!dni) return { success: false, error: "Falta el DNI." };
  if (!isPadronProgramColumn(input.column)) return { success: false, error: "Elegí el programa." };
  const column = input.column;
  const checked = checkDay(input.day);
  if ("error" in checked) return { success: false, error: checked.error };
  const note = (input.note ?? "").trim().slice(0, PROGRAM_NOTE_MAX) || null;
  const fecha = dayToDate(checked.day);
  const notAllowed = await programManageError(user, column);
  if (notAllowed) return { success: false, error: notAllowed };

  return prisma.$transaction((tx) =>
    enrollInProgramTx(tx, {
      dni,
      column,
      fecha,
      note,
      userId: user.id!,
      origen: "APP",
      detalle: `Alta desde la ficha, desde el ${dayText(fecha)}.${note ? ` ${note}` : ""}`,
    })
  );
}

/**
 * El alta dentro de una transacción ya abierta (la usan la ficha y la inscripción a un curso). Si la persona
 * no está en el padrón pero sí en el Registro Único, se la suma con esos datos. No revisa permisos.
 */
export async function enrollInProgramTx(
  tx: Prisma.TransactionClient,
  input: { dni: string; column: PadronProgramColumn; fecha: Date; note: string | null; userId: string; origen: string; detalle: string }
): Promise<Result> {
  const { dni, column, fecha, note, userId } = input;
  const program = findPadronProgram(column)!;
  let row = await lockPadronRow(tx, dni);
  if (!row) {
    const person = await tx.person.findUnique({ where: { dni } });
    if (!person) return { success: false, error: "No se encontró a la persona en el padrón ni en el Registro Único." };
    await tx.padronUnificado.createMany({
      data: [{
        dni,
        nombre_completo: [person.lastName, person.firstName].filter(Boolean).join(", ") || null,
        direccion: person.address || null,
        telefono: person.phone || null,
        email: person.email || null,
        cantidad_programas: 0,
      }],
      skipDuplicates: true,
    });
    row = await lockPadronRow(tx, dni);
    if (!row) return { success: false, error: "No se pudo sumar a la persona al padrón. Probá de nuevo." };
  }
  if (isInProgram(row as any, column)) return { success: false, error: `Ya está en ${program.label}.` };

  await tx.padronUnificado.update({
    where: { dni },
    data: {
      [column]: 1,
      cantidad_programas: { increment: 1 },
      programas_activos: addProgramToList(row.programas_activos, column),
    },
  });
  await tx.participacionPrograma.create({
    data: {
      dni,
      nombre_completo: row.nombre_completo,
      programa: program.label,
      cantidad_registros: 1,
      detalle_destacado: input.detalle,
      telefono: row.telefono,
      email: row.email,
      direccion: row.direccion,
      localidad: row.localidad,
      barrio: row.barrio,
    },
  });
  await tx.padronMovimiento.create({ data: { dni, programa: column, tipo: "ALTA", fecha, motivo: note, origen: input.origen, userId } });
  await tx.auditLog.create({
    data: {
      userId,
      action: "PADRON_PROGRAMA_ALTA",
      entity: "PadronUnificado",
      entityId: dni,
      details: `Alta en ${program.label} desde el ${dayText(fecha)}.${note ? ` ${note}` : ""}`,
    },
  });
  return { success: true };
}

/** Da de baja a la persona del programa, con la fecha y el motivo (obligatorio). */
export async function withdrawFromProgram(
  user: Actor,
  input: { dni: string; column: string; day?: string | null; reason?: string | null }
): Promise<Result> {
  if (!user.id || !canManageProgramEnrollment(user.role)) return { success: false, error: "Tu rol no puede dar bajas en los programas." };
  const dni = (input.dni ?? "").trim();
  if (!isPadronProgramColumn(input.column)) return { success: false, error: "Elegí el programa." };
  const column = input.column;
  const program = findPadronProgram(column)!;
  const checked = checkDay(input.day);
  if ("error" in checked) return { success: false, error: checked.error };
  const reason = (input.reason ?? "").trim().slice(0, PROGRAM_NOTE_MAX);
  if (!reason) return { success: false, error: "Escribí el motivo de la baja." };
  const fecha = dayToDate(checked.day);
  const notAllowed = await programManageError(user, column);
  if (notAllowed) return { success: false, error: notAllowed };

  return prisma.$transaction(async (tx) => {
    const row = await lockPadronRow(tx, dni);
    if (!row || !isInProgram(row as any, column)) return { success: false as const, error: `No está en ${program.label}.` };
    const lastAlta = await tx.padronMovimiento.findFirst({
      where: { dni, programa: column, tipo: "ALTA" },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });
    if (lastAlta && lastAlta.fecha > fecha) {
      return { success: false as const, error: `La baja no puede ser antes del alta (${dayText(lastAlta.fecha)}).` };
    }

    const wasMarked = (row as any)[column] === 1;
    await tx.padronUnificado.update({
      where: { dni },
      data: {
        [column]: 0,
        ...(wasMarked && row.cantidad_programas > 0 ? { cantidad_programas: { decrement: 1 } } : {}),
        programas_activos: removeProgramFromList(row.programas_activos, column),
      },
    });
    await tx.padronMovimiento.create({ data: { dni, programa: column, tipo: "BAJA", fecha, motivo: reason, origen: "APP", userId: user.id } });
    await tx.auditLog.create({
      data: {
        userId: user.id!,
        action: "PADRON_PROGRAMA_BAJA",
        entity: "PadronUnificado",
        entityId: dni,
        details: `Baja de ${program.label} desde el ${dayText(fecha)}. Motivo: ${reason}`,
      },
    });
    return { success: true as const };
  });
}

export type ProgramMovement = {
  id: string;
  tipo: "ALTA" | "BAJA";
  column: string;
  programa: string;
  fecha: string;
  motivo: string | null;
  origen: string;
  autor: string | null;
};

/** Las altas y bajas de la persona, de la más nueva a la más vieja. */
export async function getProgramHistory(dni: string): Promise<ProgramMovement[]> {
  const rows = await prisma.padronMovimiento.findMany({
    where: { dni },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id))));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, username: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name || u.username || null]));
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo === "BAJA" ? "BAJA" : "ALTA",
    column: r.programa,
    programa: findPadronProgram(r.programa)?.label ?? r.programa,
    fecha: r.fecha.toISOString(),
    motivo: r.motivo,
    origen: r.origen,
    autor: r.userId ? names.get(r.userId) ?? null : null,
  }));
}

/** Programas de los que la persona está dada de baja (su último movimiento es una baja). */
export async function getWithdrawnPrograms(dni: string, db: typeof prisma | Prisma.TransactionClient = prisma): Promise<Set<string>> {
  const rows = await db.$queryRaw<{ programa: string; tipo: string }[]>`
    SELECT DISTINCT ON (programa) programa, tipo
    FROM padron_movimientos
    WHERE dni = ${dni}
    ORDER BY programa, fecha DESC, "createdAt" DESC`;
  return new Set(rows.filter((r) => r.tipo === "BAJA").map((r) => r.programa));
}

export type ProgramOption = {
  column: PadronProgramColumn;
  label: string;
  /** Área que tiene a cargo el programa, si tiene. */
  areaName: string | null;
  /** Si quien mira puede darle altas y bajas en este programa. */
  canManage: boolean;
};

/** En qué programas está hoy la persona y en cuáles se la puede dar de alta, según quién mira. */
export async function getProgramEnrollment(
  dni: string,
  viewer: { role?: string | null; areaId?: string | null } = {}
): Promise<{ inPadron: boolean; active: ProgramOption[]; available: ProgramOption[] }> {
  const [row, owners] = await Promise.all([prisma.padronUnificado.findUnique({ where: { dni } }), getProgramOwners()]);
  const all: ProgramOption[] = PADRON_PROGRAMS.map((p) => {
    const owner = owners.get(p.column);
    return { column: p.column, label: p.label, areaName: owner?.areaName ?? null, canManage: canManageProgram(viewer, owner?.areaId) };
  });
  if (!row) return { inPadron: false, active: [], available: all };
  const active = all.filter((p) => isInProgram(row as any, p.column));
  return { inPadron: true, active, available: all.filter((p) => !active.some((a) => a.column === p.column)) };
}

export type ProgramMovementCount = { column: string; label: string; altas: number; bajas: number };

/** Altas y bajas de cada programa con fecha en el período (para Reportes). Solo los programas que tuvieron alguna. */
export async function getProgramMovementCounts(from: Date, to: Date): Promise<ProgramMovementCount[]> {
  // Las fechas se guardan a la medianoche UTC del día: se compara por día.
  const fromDay = new Date(`${todayInArgentina(from)}T00:00:00.000Z`);
  const toDay = new Date(`${todayInArgentina(to)}T00:00:00.000Z`);
  const rows = await prisma.padronMovimiento.groupBy({
    by: ["programa", "tipo"],
    where: { fecha: { gte: fromDay, lte: toDay } },
    _count: { _all: true },
  });
  const byColumn = new Map<string, ProgramMovementCount>();
  for (const r of rows) {
    const item = byColumn.get(r.programa) ?? { column: r.programa, label: findPadronProgram(r.programa)?.label ?? r.programa, altas: 0, bajas: 0 };
    if (r.tipo === "BAJA") item.bajas += r._count._all;
    else item.altas += r._count._all;
    byColumn.set(r.programa, item);
  }
  return Array.from(byColumn.values()).sort((a, b) => b.altas + b.bajas - (a.altas + a.bajas) || a.label.localeCompare(b.label, "es"));
}
