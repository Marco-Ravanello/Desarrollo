import prisma from "@/lib/prisma";
import { diaAR } from "@/lib/fechas";
import { canEditHR } from "@/lib/hr-labels";
import { awayFromRecord, suggestUserForRecord, type Away } from "@/lib/staff-away";

// Legajo de RRHH ↔ cuenta de la app (idea 127): quién está de licencia hoy entre los usuarios,
// y la unión entre el legajo y la cuenta.

/** Quiénes de estos usuarios están de licencia o de vacaciones hoy (solo los que tienen el legajo unido). */
export async function getAwayByUserIds(userIds: string[], now = new Date()): Promise<Map<string, Away>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const today = diaAR(now);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const records = await prisma.hRRecord.findMany({
    where: { userId: { in: ids }, status: { not: "BAJA" } },
    select: {
      userId: true,
      status: true,
      statusUntil: true,
      leaves: { where: { startDate: { lte: todayDate }, endDate: { gte: todayDate } }, select: { kind: true, startDate: true, endDate: true } },
    },
  });
  const out = new Map<string, Away>();
  for (const r of records) {
    const away = r.userId ? awayFromRecord(r, today) : null;
    if (away && r.userId) out.set(r.userId, away);
  }
  return out;
}

export type LinkableUser = { id: string; name: string; detail: string; linkedTo: string | null };

/** Para elegir la cuenta de un legajo: los usuarios activos, cuál ya tiene legajo y cuál parece ser. */
export async function getLinkOptions(rec: { id: string; firstName: string; lastName: string; email: string | null }) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      hrRecord: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { name: "asc" },
  });
  const free = users.filter((u) => !u.hrRecord || u.hrRecord.id === rec.id);
  const suggested = suggestUserForRecord(rec, free.filter((u) => !u.hrRecord));
  const options: LinkableUser[] = users.map((u) => ({
    id: u.id,
    name: u.name || u.username || "Sin nombre",
    detail: [u.username ? `usuario ${u.username}` : null, u.email].filter(Boolean).join(" · "),
    linkedTo: u.hrRecord && u.hrRecord.id !== rec.id ? `${u.hrRecord.lastName}, ${u.hrRecord.firstName}` : null,
  }));
  return { options, suggestedId: suggested?.id ?? null };
}

type Actor = { id?: string | null; role?: string | null };
type Result = { success: true } | { success: false; error: string };

/** Une (o separa, con userId null) un legajo con una cuenta de la app. Queda en Auditoría. */
export async function linkHRRecordToUser(actor: Actor, hrRecordId: string, userId: string | null): Promise<Result> {
  if (!actor.id || !canEditHR(actor.role)) {
    return { success: false, error: "Solo Superadmin y Administración General unen legajos con usuarios." };
  }
  const record = await prisma.hRRecord.findUnique({
    where: { id: hrRecordId },
    select: { id: true, firstName: true, lastName: true, userId: true, user: { select: { name: true, username: true } } },
  });
  if (!record) return { success: false, error: "No se encontró el legajo." };
  if ((record.userId ?? null) === userId) return { success: true };

  let userName: string | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true, isActive: true, hrRecord: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!user) return { success: false, error: "No se encontró ese usuario." };
    if (user.hrRecord && user.hrRecord.id !== record.id) {
      return { success: false, error: `Ese usuario ya está unido al legajo de ${user.hrRecord.lastName}, ${user.hrRecord.firstName}.` };
    }
    userName = user.name || user.username || "el usuario";
  }

  const who = `${record.lastName}, ${record.firstName}`;
  const before = record.user ? record.user.name || record.user.username || "otro usuario" : null;
  await prisma.$transaction([
    prisma.hRRecord.update({ where: { id: record.id }, data: { userId } }),
    prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "HR_CUENTA",
        entity: "HRRecord",
        entityId: record.id,
        details: userId
          ? `Unió el legajo de ${who} con el usuario ${userName}${before ? ` (antes: ${before})` : ""}.`
          : `Separó el legajo de ${who} del usuario ${before ?? ""}.`.replace(" .", "."),
      },
    }),
  ]);
  return { success: true };
}
