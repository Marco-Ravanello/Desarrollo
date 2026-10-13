"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ensurePersonInPrisma } from "@/services/people";
import { makeStoredName, saveUploadedFile, uploadUrl } from "@/lib/file-storage";

export async function uploadDocumentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

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
    return { error: `Error en el servidor: ${error.message || "Fallo desconocido"}` };
  }
}
