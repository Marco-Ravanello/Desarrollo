import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  AGREEMENT_STATUS_LABELS, canCreateAgreements, describeAgreementChanges, parseAgreementInput, parseStatusChange,
} from "@/lib/convenios";
import { describeAuditAction, formatAuditDetails } from "@/lib/audit-labels";

// La ficha de un convenio: corregir sus datos y cambiarle el estado con motivo (la conducción),
// y la historia de todo lo que se le hizo, sacada de Auditoría.

type Actor = { id?: string | null };
type Result = { success: true } | { success: false; error: string };

const NO_PERMISSION = "Los convenios los cambian Administración General, Dirección General y Superadmin.";

async function actorFromDb(user: Actor) {
  if (!user.id) return null;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, isActive: true } });
  return u?.isActive && canCreateAgreements(u.role) ? u : null;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (d: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null);

export async function updateAgreement(user: Actor, id: string, raw: Record<string, unknown>): Promise<Result> {
  const actor = await actorFromDb(user);
  if (!actor) return { success: false, error: NO_PERMISSION };
  const before = await prisma.agreement.findUnique({ where: { id }, include: { area: { select: { name: true } } } });
  if (!before) return { success: false, error: "No se encontró el convenio." };
  const parsed = parseAgreementInput(raw, { withStatus: false });
  if (!parsed.ok) return { success: false, error: parsed.error };
  const data = parsed.data;
  const area = data.areaId ? await prisma.area.findUnique({ where: { id: data.areaId }, select: { name: true } }) : null;
  if (data.areaId && !area) return { success: false, error: "El área elegida ya no existe. Recargá la página." };

  const cambios = describeAgreementChanges(
    {
      title: before.title, number: before.number, parties: before.parties, description: before.description,
      amount: before.amount === null ? null : Number(before.amount), startDate: iso(before.startDate), endDate: iso(before.endDate),
      areaName: before.area?.name ?? null,
    },
    {
      title: data.title, number: data.number, parties: data.parties, description: data.description,
      amount: data.amount, startDate: data.startDate, endDate: data.endDate, areaName: area?.name ?? null,
    }
  );
  if (cambios.length === 0) return { success: false, error: "No cambiaste ningún dato." };

  try {
    await prisma.agreement.update({
      where: { id },
      data: {
        title: data.title, number: data.number, parties: data.parties, description: data.description, amount: data.amount,
        startDate: toDate(data.startDate), endDate: toDate(data.endDate), areaId: data.areaId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "Ya hay otro convenio cargado con ese número." };
    }
    throw err;
  }
  await prisma.auditLog.create({
    data: { userId: actor.id, action: "UPDATE", entity: "Agreement", entityId: id, details: JSON.stringify({ title: data.title, cambios: cambios.join(" · ") }) },
  });
  return { success: true };
}

export async function changeAgreementStatus(user: Actor, id: string, raw: Record<string, unknown>): Promise<Result> {
  const actor = await actorFromDb(user);
  if (!actor) return { success: false, error: NO_PERMISSION };
  const before = await prisma.agreement.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!before) return { success: false, error: "No se encontró el convenio." };
  const parsed = parseStatusChange(raw, before.status);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { status, motivo } = parsed.data;
  await prisma.agreement.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "AGREEMENT_STATUS",
      entity: "Agreement",
      entityId: id,
      details: JSON.stringify({ estado: `${AGREEMENT_STATUS_LABELS[before.status] ?? before.status} → ${AGREEMENT_STATUS_LABELS[status]}`, motivo }),
    },
  });
  return { success: true };
}

export type HistoriaConvenio = { id: string; fecha: Date; quien: string; que: string; detalle: string };

/** Lo que se le hizo al convenio (los datos y el estado; las horas cargadas no, que son muchas). */
export async function getAgreementHistory(id: string, take = 30): Promise<HistoriaConvenio[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      entity: "Agreement",
      entityId: id,
      NOT: { action: { startsWith: "CONVENIO_HORAS" } },
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    fecha: l.createdAt,
    quien: l.user?.name ?? "Alguien",
    que: describeAuditAction(l.action, l.entity).label,
    detalle: formatAuditDetails(l.details),
  }));
}
