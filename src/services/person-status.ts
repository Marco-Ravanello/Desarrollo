import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { findPadronProgram } from "@/lib/padron-programs";
import {
  PERSON_STATUS_NOTE_MAX, canMarkPersonStatus, canUndoPersonStatus, isPersonStatus, personStatusText, withdrawReason,
  type PersonStatus,
} from "@/lib/person-status";
import { activePrograms, withdrawFromProgramTx } from "@/services/program-enrollment";

// Personas que fallecieron o se mudaron fuera del distrito (tabla personas_estado). Al marcarlas salen de
// sus programas (con la baja y el motivo), de las recorridas que todavía no se hicieron y de los avisos.

type Actor = { id?: string | null; role?: string | null };
type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

export type PersonStatusView = {
  estado: PersonStatus;
  fecha: string | null;
  nota: string | null;
  texto: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function getPersonStatus(dni: string): Promise<PersonStatusView | null> {
  const row = await prisma.personaEstado.findUnique({ where: { dni } });
  if (!row || !isPersonStatus(row.estado)) return null;
  const user = row.userId ? await prisma.user.findUnique({ where: { id: row.userId }, select: { name: true } }) : null;
  const fecha = isoDay(row.fecha);
  return {
    estado: row.estado,
    fecha,
    nota: row.nota,
    texto: personStatusText(row.estado, fecha),
    userId: row.userId,
    userName: user?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** De estos DNI, los que están marcados (para sacarlos de listas y avisos). */
export async function markedDnis(dnis: string[]): Promise<Set<string>> {
  if (!dnis.length) return new Set();
  const rows = await prisma.personaEstado.findMany({ where: { dni: { in: dnis } }, select: { dni: true } });
  return new Set(rows.map((r) => r.dni));
}

/** Marca a la persona y la da de baja de todo. Devuelve los programas de los que salió y las visitas que se sacaron. */
export async function markPersonStatus(
  user: Actor,
  input: { dni: string; estado: unknown; day?: string | null; note?: string | null }
): Promise<Result<{ programas: string[]; visitas: number }>> {
  if (!user.id || !canMarkPersonStatus(user.role)) return { success: false, error: "Tu rol no puede marcar esto." };
  const dni = (input.dni ?? "").trim();
  if (!dni) return { success: false, error: "Falta el DNI." };
  if (!isPersonStatus(input.estado)) return { success: false, error: "Elegí si falleció o se mudó." };
  const estado = input.estado;
  const today = todayInArgentina();
  const day = (input.day ?? "").trim() || null;
  if (day && (!ISO_DAY.test(day) || day > today || day < "1990-01-01")) return { success: false, error: "Revisá la fecha: no puede ser posterior a hoy." };
  const note = (input.note ?? "").trim().slice(0, PERSON_STATUS_NOTE_MAX) || null;

  const [padron, person] = await Promise.all([
    prisma.padronUnificado.findUnique({ where: { dni }, select: { dni: true } }),
    prisma.person.findUnique({ where: { dni }, select: { id: true } }),
  ]);
  if (!padron && !person) return { success: false, error: "No se encontró a la persona." };

  const fecha = new Date(`${day ?? today}T00:00:00.000Z`);
  const reason = withdrawReason(estado, note);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.personaEstado.findUnique({ where: { dni } });
    if (existing) return { success: false as const, error: "Ya estaba marcada. Si hay que cambiarlo, deshacelo primero." };
    await tx.personaEstado.create({ data: { dni, estado, fecha: day ? fecha : null, nota: note, userId: user.id! } });

    // Las bajas, con la fecha que se cargó (o hoy). Si la baja quedaría antes del alta, va con la fecha de hoy.
    const programas: string[] = [];
    const row = await tx.padronUnificado.findUnique({ where: { dni } });
    if (row) {
      for (const column of activePrograms(row as any)) {
        let res = await withdrawFromProgramTx(tx, { dni, column, fecha, reason, userId: user.id!, origen: "APP" });
        if (!res.success && day) {
          res = await withdrawFromProgramTx(tx, { dni, column, fecha: new Date(`${today}T00:00:00.000Z`), reason, userId: user.id!, origen: "APP" });
        }
        if (res.success) programas.push(findPadronProgram(column)!.label);
      }
    }

    // Las visitas que todavía no se hicieron, en recorridas que no terminaron.
    const { count: visitas } = await tx.recorridaVisita.deleteMany({
      where: { dni, resultado: "PENDIENTE", recorrida: { estado: "PLANIFICADA" } },
    });

    const texto = personStatusText(estado, day);
    await tx.auditLog.create({
      data: {
        userId: user.id!,
        action: "UPDATE",
        entity: "Persona",
        entityId: dni,
        details: [
          `Marcada: ${texto.toLowerCase()}.${note ? ` ${note}` : ""}`,
          programas.length ? `Baja de ${programas.join(", ")}.` : null,
          visitas ? `Salió de ${visitas === 1 ? "1 recorrida" : `${visitas} recorridas`} que todavía no se hicieron.` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    return { success: true as const, programas, visitas };
  });
}

/** Deshace la marca (por si fue un error). Las bajas de los programas quedan: si vuelve, se le da el alta de nuevo. */
export async function clearPersonStatus(user: Actor, dniRaw: string): Promise<Result> {
  const dni = (dniRaw ?? "").trim();
  const row = await prisma.personaEstado.findUnique({ where: { dni } });
  if (!row) return { success: false, error: "No estaba marcada." };
  if (!user.id || !canUndoPersonStatus(user, row.userId)) return { success: false, error: "Lo puede deshacer quien lo marcó o la conducción." };
  await prisma.$transaction([
    prisma.personaEstado.delete({ where: { dni } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entity: "Persona",
        entityId: dni,
        details: `Se sacó la marca "${isPersonStatus(row.estado) ? personStatusText(row.estado, isoDay(row.fecha)).toLowerCase() : row.estado}". Las bajas de los programas quedan como estaban.`,
      },
    }),
  ]);
  return { success: true };
}
