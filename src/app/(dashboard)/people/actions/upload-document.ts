"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ensurePersonInPrisma } from "@/services/people";
import { makeStoredName, saveUploadedFile, uploadUrl } from "@/lib/file-storage";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords } from "@/lib/permissions";

export async function uploadDocumentAction(formData: FormData) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user) return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  const file = formData.get("file") as File;
  const personId = formData.get("personId") as string;
  const caseId = formData.get("caseId") as string;

  if (!file || file.size === 0) return { error: "No se seleccionó ningún archivo válido" };

  try {
    let validPersonId = null;
    if (personId) {
      const person = await ensurePersonInPrisma(personId);
      validPersonId = person ? person.id : null;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedName = makeStoredName(file.name);
    await saveUploadedFile(storedName, buffer, file.type);

    const document = await prisma.document.create({
      data: {
        name: file.name,
        url: uploadUrl(storedName),
        fileType: file.type,
        personId: validPersonId,
        caseId: caseId || null,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'UPLOAD_DOCUMENT',
        entity: 'Document',
        entityId: document.id,
        details: `Archivo subido: ${file.name}`
      }
    });

    if (personId) revalidatePath(`/people/${personId}`);
    if (validPersonId) revalidatePath(`/people/${validPersonId}`);
    if (caseId) revalidatePath(`/people/${personId || 'any'}`);

    return { success: true, fileName: file.name };
  } catch (error: any) {
    console.error("UPLOAD_ERROR:", error);
    return { error: actionErrorMessage(error, "No se pudo subir el documento") };
  }
}
