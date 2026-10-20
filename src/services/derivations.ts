import type { CaseStatus, Prisma, Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { MANAGEMENT_ROLES, canEditSocialRecords, hasPermission, isEmergencySurveyor, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";

// Derivaciones de expedientes entre áreas: un área deriva, la otra acepta (el
// expediente pasa a ser suyo) o rechaza con un motivo (vuelve al área que derivó).

export type DerivationUser = { id: string; name?: string | null; role: Role; areaId?: string | null };

type Result = { success: true } | { success: false; error: string };

const fail = (error: string): Result => ({ success: false, error });

/** Cargan y derivan expedientes: todos menos Auditoría y el relevador de emergencia. */
export function canDeriveCases(user: Pick<DerivationUser, "role">): boolean {
  return canEditSocialRecords(user.role) && !isEmergencySurveyor(user.role);
}

/** Responde una derivación quien es del área que la recibe, o la conducción. */
export function canRespondDerivation(user: Pick<DerivationUser, "role" | "areaId">, toAreaId: string): boolean {
  return canDeriveCases(user) && (MANAGEMENT_ROLES.includes(user.role) || user.areaId === toAreaId);
}

async function notify(userIds: string[], title: string, message: string, link: string) {
  const ids = Array.from(new Set(userIds));
  if (ids.length) await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title, message, link })) });
}

export async function createDerivation(
  user: DerivationUser,
  input: { caseId: string; toAreaId: string; reason: string; observations?: string | null }
): Promise<Result> {
  if (!canDeriveCases(user)) return fail("Tu rol no puede derivar expedientes.");
  const reason = input.reason?.trim();
  if (!reason) return fail("Escribí el motivo de la derivación.");

  const caseItem = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: { id: true, title: true, status: true, areaId: true, area: { select: { name: true } } },
  });
  if (!caseItem) return fail("Expediente no encontrado.");
  if (isSensitiveArea(caseItem.area?.name) && !hasPermission(user.role, PERMISSIONS.VIEW_SENSITIVE_CASES)) {
    return fail("No tenés permiso para este expediente.");
  }
  if (caseItem.status === "CERRADO") return fail("El expediente está cerrado. No se puede derivar.");
  if (input.toAreaId === caseItem.areaId) return fail("El expediente ya es de esa área.");

  const toArea = await prisma.area.findUnique({ where: { id: input.toAreaId }, select: { id: true, name: true } });
  if (!toArea) return fail("Elegí el área a la que lo derivás.");

  const pending = await prisma.derivation.findFirst({ where: { caseId: caseItem.id, status: "PENDIENTE" }, select: { id: true } });
  if (pending) return fail("Este expediente ya tiene una derivación esperando respuesta.");

  const derivation = await prisma.derivation.create({
    data: {
      caseId: caseItem.id,
      fromAreaId: caseItem.areaId,
      toAreaId: toArea.id,
      reason,
      observations: input.observations?.trim() || null,
      status: "PENDIENTE",
      previousStatus: caseItem.status,
      createdById: user.id,
      createdByName: user.name || null,
    },
  });
  await prisma.case.update({ where: { id: caseItem.id }, data: { status: "DERIVADO" } });

  const receivers = await prisma.user.findMany({ where: { areaId: toArea.id, isActive: true, NOT: { id: user.id } }, select: { id: true } });
  await notify(
    receivers.map((u) => u.id),
    "Expediente derivado a tu área",
    `${caseItem.area?.name || "Otra área"} derivó el expediente "${caseItem.title}". Aceptalo o rechazalo desde el expediente.`,
    `/cases/${caseItem.id}`
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CASE_DERIVATION_CREATED",
      entity: "Derivation",
      entityId: derivation.id,
      details: `Expediente "${caseItem.title}" derivado de ${caseItem.area?.name || "sin área"} a ${toArea.name}. Motivo: ${reason}`,
    },
  });
  return { success: true };
}

export async function respondDerivation(
  user: DerivationUser,
  input: { derivationId: string; accept: boolean; response?: string | null }
): Promise<Result> {
  const derivation = await prisma.derivation.findUnique({
    where: { id: input.derivationId },
    include: {
      case: { select: { id: true, title: true } },
      fromArea: { select: { name: true } },
      toArea: { select: { name: true } },
    },
  });
  if (!derivation) return fail("Derivación no encontrada.");
  if (!canRespondDerivation(user, derivation.toAreaId)) {
    return fail(`Solo puede responderla alguien de ${derivation.toArea.name} o de la conducción.`);
  }
  if (derivation.status !== "PENDIENTE") return fail("Esta derivación ya fue respondida.");

  const response = input.response?.trim() || null;
  if (!input.accept && !response) return fail("Escribí el motivo del rechazo.");

  const status = input.accept ? "ACEPTADA" : "RECHAZADA";
  // Solo la primera respuesta cuenta, aunque dos personas respondan a la vez.
  const updated = await prisma.derivation.updateMany({
    where: { id: derivation.id, status: "PENDIENTE" },
    data: { status, response, respondedAt: new Date(), respondedById: user.id, respondedByName: user.name || null },
  });
  if (updated.count === 0) return fail("Esta derivación ya fue respondida.");

  const caseData: Prisma.CaseUncheckedUpdateInput = input.accept
    ? // El área que lo recibe elige a su profesional.
      { areaId: derivation.toAreaId, status: "EN_PROCESO", assignedToId: null, assignedAt: null }
    : { status: rejectedStatus(derivation.previousStatus) };
  await prisma.case.update({ where: { id: derivation.caseId }, data: caseData });

  const toNotify = derivation.createdById && derivation.createdById !== user.id ? [derivation.createdById] : [];
  await notify(
    toNotify,
    input.accept ? "Derivación aceptada" : "Derivación rechazada",
    input.accept
      ? `${derivation.toArea.name} aceptó el expediente "${derivation.case.title}" y sigue con el caso.`
      : `${derivation.toArea.name} rechazó el expediente "${derivation.case.title}": ${response}. Volvió a ${derivation.fromArea.name}.`,
    `/cases/${derivation.caseId}`
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: input.accept ? "CASE_DERIVATION_ACCEPTED" : "CASE_DERIVATION_REJECTED",
      entity: "Derivation",
      entityId: derivation.id,
      details: `${derivation.toArea.name} ${input.accept ? "aceptó" : "rechazó"} el expediente "${derivation.case.title}" derivado por ${derivation.fromArea.name}${response ? `. ${input.accept ? "Comentario" : "Motivo"}: ${response}` : ""}`,
    },
  });
  return { success: true };
}

/** Si se rechaza, el expediente vuelve al estado que tenía (nunca queda "Derivado"). */
function rejectedStatus(previous: CaseStatus | null): CaseStatus {
  return previous && previous !== "DERIVADO" && previous !== "CERRADO" ? previous : "EN_PROCESO";
}

/** Quien es del área que recibe una derivación pendiente puede abrir el expediente para decidir, aunque sea reservado. */
export async function hasPendingDerivationFor(user: Pick<DerivationUser, "areaId">, caseId: string): Promise<boolean> {
  if (!user.areaId) return false;
  const found = await prisma.derivation.findFirst({ where: { caseId, toAreaId: user.areaId, status: "PENDIENTE" }, select: { id: true } });
  return Boolean(found);
}

export type DerivationRow = {
  id: string;
  caseId: string;
  caseTitle: string;
  person: string | null;
  fromArea: string;
  toArea: string;
  toAreaId: string;
  reason: string;
  observations: string | null;
  status: "PENDIENTE" | "ACEPTADA" | "RECHAZADA" | "COMPLETADA";
  createdAt: string;
  createdBy: string | null;
  respondedAt: string | null;
  respondedBy: string | null;
  response: string | null;
};

const rowInclude = {
  case: { select: { title: true, person: { select: { firstName: true, lastName: true } } } },
  fromArea: { select: { name: true } },
  toArea: { select: { name: true } },
} satisfies Prisma.DerivationInclude;

function toRow(d: Prisma.DerivationGetPayload<{ include: typeof rowInclude }>): DerivationRow {
  const p = d.case.person;
  return {
    id: d.id,
    caseId: d.caseId,
    caseTitle: d.case.title,
    person: p ? `${p.lastName}, ${p.firstName}` : null,
    fromArea: d.fromArea.name,
    toArea: d.toArea.name,
    toAreaId: d.toAreaId,
    reason: d.reason,
    observations: d.observations,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    createdBy: d.createdByName,
    respondedAt: d.respondedAt?.toISOString() ?? null,
    respondedBy: d.respondedByName,
    response: d.response,
  };
}

/** Historial de derivaciones de un expediente, la más nueva primero. */
export async function getCaseDerivations(caseId: string): Promise<DerivationRow[]> {
  const rows = await prisma.derivation.findMany({ where: { caseId }, orderBy: { createdAt: "desc" }, include: rowInclude });
  return rows.map(toRow);
}

/** Lo que ve cada uno: con área, las de su área; la conducción (o quien no tiene área), todas. */
function scopeFor(user: DerivationUser) {
  return MANAGEMENT_ROLES.includes(user.role) || !user.areaId ? null : user.areaId;
}

/** Expedientes reservados: sin permiso solo se ven si la derivación llega al área de quien mira. */
function sensitiveFilter(user: DerivationUser): Prisma.DerivationWhereInput {
  if (hasPermission(user.role, PERMISSIONS.VIEW_SENSITIVE_CASES)) return {};
  const notSensitive: Prisma.DerivationWhereInput = {
    NOT: [
      { fromArea: { name: { contains: "violencia", mode: "insensitive" } } },
      { toArea: { name: { contains: "violencia", mode: "insensitive" } } },
    ],
  };
  return user.areaId ? { OR: [notSensitive, { toAreaId: user.areaId, status: "PENDIENTE" }] } : notSensitive;
}

export async function getDerivationInbox(user: DerivationUser) {
  const area = scopeFor(user);
  const visible = sensitiveFilter(user);
  const [toAnswer, sent, received] = await Promise.all([
    prisma.derivation.findMany({
      where: { AND: [visible, { status: "PENDIENTE" }, area ? { toAreaId: area } : {}] },
      orderBy: { createdAt: "asc" },
      include: rowInclude,
      take: 200,
    }),
    prisma.derivation.findMany({
      where: { AND: [visible, area ? { fromAreaId: area } : {}] },
      orderBy: { createdAt: "desc" },
      include: rowInclude,
      take: 100,
    }),
    prisma.derivation.findMany({
      where: { AND: [visible, { status: { not: "PENDIENTE" } }, area ? { toAreaId: area } : {}] },
      orderBy: { respondedAt: "desc" },
      include: rowInclude,
      take: 100,
    }),
  ]);
  return {
    scoped: Boolean(area),
    toAnswer: toAnswer.filter((d) => canRespondDerivation(user, d.toAreaId)).map(toRow),
    sent: sent.map(toRow),
    received: received.map(toRow),
  };
}

/** Cuántas derivaciones esperan respuesta de quien mira (para el inicio y el listado). */
export async function countDerivationsToAnswer(user: DerivationUser): Promise<number> {
  if (!canDeriveCases(user)) return 0;
  const area = scopeFor(user);
  if (area === null && !MANAGEMENT_ROLES.includes(user.role)) return 0;
  return prisma.derivation.count({ where: { AND: [sensitiveFilter(user), { status: "PENDIENTE" }, area ? { toAreaId: area } : {}] } });
}
