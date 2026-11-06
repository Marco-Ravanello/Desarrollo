import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canEditSocialRecords, hasPermission, isEmergencySurveyor, PERMISSIONS } from "@/lib/permissions";
import { todayInArgentina, addDays } from "@/lib/follow-up-dates";
import { EXPIRY_WARN_DAYS, checkExpiry, documentKindLabel, isDocumentKind } from "@/lib/document-kinds";
import { isSensitiveArea } from "@/lib/sensitive-areas";

// Vencimientos de los documentos de las personas (el CUD, por ejemplo): cambiarlos y la lista de los que vencen.

type Actor = { id?: string | null; role?: string | null };
type Result = { success: true; dni: string | null } | { success: false; error: string };

export const canEditDocuments = (role?: string | null) => canEditSocialRecords(role) && !isEmergencySurveyor(role);

/** Los documentos de expedientes de Violencia de Género solo para quien puede verlos. */
export function visibleDocumentsWhere(role?: string | null): Prisma.DocumentWhereInput {
  if (role && hasPermission(role as any, PERMISSIONS.VIEW_SENSITIVE_CASES)) return {};
  return { OR: [{ caseId: null }, { case: { NOT: { area: { name: { contains: "violencia", mode: "insensitive" } } } } }] };
}

/** Cambia el tipo y el vencimiento de un documento (por ejemplo, cuando se renueva el CUD). */
export async function setDocumentExpiry(user: Actor, id: string, input: { kind: unknown; day: unknown }): Promise<Result> {
  if (!user.id || !canEditDocuments(user.role)) return { success: false, error: "Tu rol no puede cambiar documentos." };
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, name: true, kind: true, expiresAt: true, person: { select: { dni: true } }, case: { select: { area: { select: { name: true } } } } },
  });
  if (!doc) return { success: false, error: "No se encontró el documento." };
  if (isSensitiveArea(doc.case?.area?.name) && !hasPermission(user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES)) {
    return { success: false, error: "No se encontró el documento." };
  }
  const kind = isDocumentKind(input.kind) ? input.kind : null;
  const checked = checkExpiry(input.day, todayInArgentina());
  if ("error" in checked) return { success: false, error: checked.error };
  const expiresAt = checked.day ? new Date(`${checked.day}T00:00:00.000Z`) : null;
  const before = doc.expiresAt ? doc.expiresAt.toISOString().slice(0, 10).split("-").reverse().join("/") : "sin vencimiento";
  const after = checked.day ? checked.day.split("-").reverse().join("/") : "sin vencimiento";
  await prisma.$transaction([
    prisma.document.update({ where: { id }, data: { kind, expiresAt } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DOCUMENT_VENCIMIENTO",
        entity: "Document",
        entityId: id,
        details: `${documentKindLabel(kind)} (${doc.name}): ${before} → ${after}.`,
      },
    }),
  ]);
  return { success: true, dni: doc.person?.dni ?? null };
}

export type ExpiringView = "por-vencer" | "vencidos";

export type ExpiringDocument = {
  id: string;
  kind: string | null;
  name: string;
  expiresAt: string;
  hasFile: boolean;
  dni: string;
  persona: string;
};

/**
 * Los documentos que vencen en los próximos 60 días o que ya vencieron (en el último año), de personas que
 * no fallecieron ni se mudaron. Los de Violencia de Género, solo para quien puede verlos.
 */
export async function listExpiringDocuments(role: string | null | undefined, view: ExpiringView, today = todayInArgentina()) {
  const start = new Date(`${today}T00:00:00.000Z`);
  const range =
    view === "por-vencer"
      ? { gte: start, lte: new Date(`${addDays(today, EXPIRY_WARN_DAYS)}T00:00:00.000Z`) }
      : { lt: start, gte: new Date(`${addDays(today, -365)}T00:00:00.000Z`) };
  const base: Prisma.DocumentWhereInput = {
    personId: { not: null },
    AND: [visibleDocumentsWhere(role), { person: { dni: { notIn: await markedDniList() } } }],
  };
  const [rows, porVencer, vencidos] = await Promise.all([
    prisma.document.findMany({
      where: { ...base, expiresAt: range },
      orderBy: { expiresAt: view === "por-vencer" ? "asc" : "desc" },
      take: 300,
      select: { id: true, kind: true, name: true, url: true, expiresAt: true, person: { select: { dni: true, firstName: true, lastName: true } } },
    }),
    prisma.document.count({ where: { ...base, expiresAt: { gte: start, lte: new Date(`${addDays(today, EXPIRY_WARN_DAYS)}T00:00:00.000Z`) } } }),
    prisma.document.count({ where: { ...base, expiresAt: { lt: start, gte: new Date(`${addDays(today, -365)}T00:00:00.000Z`) } } }),
  ]);
  const docs: ExpiringDocument[] = rows
    .filter((r) => r.person)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      expiresAt: r.expiresAt!.toISOString().slice(0, 10),
      hasFile: Boolean(r.url),
      dni: r.person!.dni,
      persona: [r.person!.lastName, r.person!.firstName].filter(Boolean).join(", ") || `DNI ${r.person!.dni}`,
    }));
  return { docs, porVencer, vencidos };
}

/** Las personas marcadas como fallecidas o mudadas (son pocas: se traen todas). */
async function markedDniList(): Promise<string[]> {
  const rows = await prisma.personaEstado.findMany({ select: { dni: true } });
  return rows.map((r) => r.dni);
}
