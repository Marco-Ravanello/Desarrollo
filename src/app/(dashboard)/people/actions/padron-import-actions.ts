"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { findPadronProgram } from "@/lib/padron-programs";
import { PADRON_IMPORT_CHUNK, sanitizeRecords, type RowProblem } from "@/lib/padron-import";
import { applyPadronImport, planPadronImport, type PadronImportCounts } from "@/services/padron-import";

type PadronImportResult =
  | { success: true; counts: PadronImportCounts; errors: RowProblem[] }
  | { success: false; error: string };

async function checkAccess(column: string, records: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tu sesión expiró. Volvé a iniciar sesión." } as const;
  if (!MANAGEMENT_ROLES.includes(session.user.role)) {
    return { error: "Tu rol no tiene permiso para importar personas al padrón." } as const;
  }
  const program = findPadronProgram(column);
  if (!program) return { error: "Elegí un programa de la lista." } as const;
  const clean = sanitizeRecords(records);
  if (clean.length === 0) return { error: "La planilla no tiene filas con DNI válido para importar." } as const;
  if (clean.length > PADRON_IMPORT_CHUNK) return { error: "Demasiadas filas en un solo envío." } as const;
  return { session, program, records: clean } as const;
}

/** Revisa una tanda de la planilla sin guardar nada: cuántas son nuevas, cuántas ya estaban, errores. */
export async function previewPadronImportAction(column: string, records: unknown): Promise<PadronImportResult> {
  const access = await checkAccess(column, records);
  if ("error" in access) return { success: false, error: access.error! };
  try {
    const { counts, errors } = await planPadronImport(access.records, access.program.column);
    return { success: true, counts, errors };
  } catch (err) {
    console.error("Error revisando la importación al padrón:", err);
    return { success: false, error: actionErrorMessage(err, "No se pudo revisar la planilla") };
  }
}

/** Guarda una tanda de la planilla en el padrón y la marca en el programa. */
export async function importPadronChunkAction(
  column: string,
  records: unknown,
  fileName: string,
  part: number,
  totalParts: number
): Promise<PadronImportResult> {
  const access = await checkAccess(column, records);
  if ("error" in access) return { success: false, error: access.error! };
  const { session, program } = access;
  const name = String(fileName || "").slice(0, 120);

  try {
    const { counts, errors } = await applyPadronImport(access.records, program.column, program.label, name);

    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id!,
          action: "PADRON_IMPORT",
          entity: "PadronUnificado",
          entityId: program.column,
          details: `Importación al padrón (${program.label})${name ? `, archivo ${name}` : ""}${totalParts > 1 ? `, parte ${part} de ${totalParts}` : ""}: ${counts.created} personas nuevas, ${counts.completed} con datos completados, ${counts.joined} sumadas al programa, ${errors.length} filas sin cargar. Por ${session.user.name || session.user.email}.`,
        },
      })
      .catch((e) => console.warn("AuditLog skipped:", e));

    revalidatePath("/people");
    revalidatePath("/ficha-social");
    return { success: true, counts, errors };
  } catch (err) {
    console.error("Error importando al padrón:", err);
    return { success: false, error: actionErrorMessage(err, "No se pudo importar esta parte de la planilla") };
  }
}
