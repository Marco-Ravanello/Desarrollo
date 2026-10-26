import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CASE_LABELS, describeLabelChange, normalizeCaseLabels, type CaseLabelKey } from "@/lib/case-labels";
import { canEditSocialRecords, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";

type Actor = { id?: string | null; role?: string | null };

/**
 * Cambia las etiquetas de un expediente y lo anota en su historia. Puede quien carga datos sociales;
 * los de Violencia de Género, solo quien puede verlos.
 */
export async function updateCaseLabels(user: Actor, caseId: string, input: unknown) {
  if (!user.id) return { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!canEditSocialRecords(user.role as any)) {
    return { success: false as const, error: "Tu rol puede consultar pero no cambiar las etiquetas." };
  }
  const caseItem = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, labels: true, area: { select: { name: true } } },
  });
  if (!caseItem) return { success: false as const, error: "No se encontró el expediente." };
  if (isSensitiveArea(caseItem.area?.name) && !hasPermission(user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES)) {
    return { success: false as const, error: "Tu rol no puede cambiar este expediente." };
  }

  const labels = normalizeCaseLabels(input);
  const change = describeLabelChange(caseItem.labels, labels);
  if (!change) return { success: true as const, labels };

  await prisma.$transaction([
    prisma.case.update({ where: { id: caseId }, data: { labels } }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "CASE_LABELS", entity: "Case", entityId: caseId, details: change },
    }),
  ]);
  return { success: true as const, labels };
}

export type CaseLabelCount = { key: CaseLabelKey; label: string; total: number; open: number };

/**
 * Cuántos expedientes tiene cada etiqueta (todos y sin cerrar), en el orden de la lista.
 * Sin permiso para Violencia de Género, esos no se cuentan (la misma regla que el listado).
 * `createdFrom`/`createdTo` limitan a los abiertos en ese período (para Reportes).
 */
export async function getCaseLabelCounts(opts: {
  canViewSensitive: boolean;
  createdFrom?: Date;
  createdTo?: Date;
}): Promise<CaseLabelCount[]> {
  const conditions: Prisma.Sql[] = [];
  if (!opts.canViewSensitive) conditions.push(Prisma.sql`a."name" NOT ILIKE '%violencia%'`);
  if (opts.createdFrom) conditions.push(Prisma.sql`c."createdAt" >= ${opts.createdFrom}`);
  if (opts.createdTo) conditions.push(Prisma.sql`c."createdAt" <= ${opts.createdTo}`);
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  const rows = await prisma.$queryRaw<{ label: string; total: bigint; open: bigint }[]>`
    SELECT l AS label,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE c."status" <> 'CERRADO') AS open
    FROM "Case" c
    JOIN "Area" a ON a."id" = c."areaId"
    CROSS JOIN LATERAL unnest(c."labels") AS l
    ${where}
    GROUP BY l`;
  const byKey = new Map(rows.map((r) => [r.label, r]));
  return CASE_LABELS.map((l) => ({
    key: l.key,
    label: l.label,
    total: Number(byKey.get(l.key)?.total ?? 0),
    open: Number(byKey.get(l.key)?.open ?? 0),
  }));
}
