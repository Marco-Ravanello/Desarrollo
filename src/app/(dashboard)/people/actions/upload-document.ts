"use server";

import { writeFile } from "fs/promises";
import { join } from "path";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function uploadDocumentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const file = formData.get("file") as File;
  const personId = formData.get("personId") as string;
  const caseId = formData.get("caseId") as string;

  if (!file) return { error: "No se seleccionó ningún archivo" };

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}-${file.name}`;
    const path = join(process.cwd(), "public", "uploads", fileName);
    await writeFile(path, buffer);

    const document = await prisma.document.create({
      data: {
        name: file.name,
        url: `/uploads/${fileName}`,
        fileType: file.type,
        personId: personId || null,
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
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al subir el archivo" };
  }
}
