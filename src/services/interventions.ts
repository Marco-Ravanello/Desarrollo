import type { InterventionType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canEditSocialRecords } from "@/lib/permissions";
import { canEditIntervention, interventionTypeLabel, isInterventionType } from "@/lib/intervention-types";

// Intervenciones de un expediente: quién las cargó, de qué tipo son y sus correcciones.

export type InterventionRow = {
  id: string;
  date: string;
  description: string;
  type: InterventionType | null;
  author: string | null;
  editedAt: string | null;
  canEdit: boolean;
  edits: { id: string; date: string; previousDescription: string; previousType: InterventionType | null; editedBy: string | null }[];
};

export async function getCaseInterventions(caseId: string, viewerId?: string | null): Promise<InterventionRow[]> {
  const interventions = await prisma.intervention.findMany({
    where: { caseId },
    orderBy: { date: "desc" },
    include: { edits: { orderBy: { createdAt: "desc" } } },
  });
  const userIds = Array.from(new Set(interventions.map((i) => i.userId)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name || null]));
  const now = new Date();

  return interventions.map((i) => ({
    id: i.id,
    date: i.date.toISOString(),
    description: i.description,
    type: i.type,
    author: names.get(i.userId) ?? null,
    editedAt: i.editedAt?.toISOString() ?? null,
    canEdit: canEditIntervention(i, viewerId, now),
    edits: i.edits.map((e) => ({
      id: e.id,
      date: e.createdAt.toISOString(),
      previousDescription: e.previousDescription,
      previousType: e.previousType,
      editedBy: e.editedByName,
    })),
  }));
}

type Result = { success: true } | { success: false; error: string };

/** Corrige el texto o el tipo de una intervención. Guarda la versión anterior. */
export async function editIntervention(
  user: { id: string; name?: string | null; role: string },
  input: { interventionId: string; description: string; type: unknown }
): Promise<Result> {
  if (!canEditSocialRecords(user.role)) return { success: false, error: "Tu rol puede consultar pero no corregir intervenciones." };
  const description = input.description?.trim();
  if (!description) return { success: false, error: "La intervención no puede quedar vacía." };
  if (!isInterventionType(input.type)) return { success: false, error: "Elegí el tipo de intervención." };

  const current = await prisma.intervention.findUnique({ where: { id: input.interventionId } });
  if (!current) return { success: false, error: "La intervención ya no existe. Actualizá la página." };
  if (current.userId !== user.id) return { success: false, error: "Solo la puede corregir quien la cargó." };
  if (!canEditIntervention(current, user.id)) return { success: false, error: "Solo se puede corregir el mismo día en que se cargó." };
  if (current.description === description && current.type === input.type) return { success: true };

  await prisma.$transaction([
    prisma.interventionEdit.create({
      data: {
        interventionId: current.id,
        previousDescription: current.description,
        previousType: current.type,
        editedById: user.id,
        editedByName: user.name || null,
      },
    }),
    prisma.intervention.update({
      where: { id: current.id },
      data: { description, type: input.type, editedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EDIT_INTERVENTION",
        entity: "Case",
        entityId: current.caseId,
        details: `Intervención corregida (${interventionTypeLabel(input.type)}). Decía: ${current.description.slice(0, 500)}`,
      },
    }),
  ]);
  return { success: true };
}
