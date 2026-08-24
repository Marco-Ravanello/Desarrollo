"use server";

import { writeFile, mkdir } from "fs/promises";
import { join, basename, resolve } from "path";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function uploadDocumentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const file = formData.get("file") as File;
  const personId = formData.get("personId") as string;
  const caseId = formData.get("caseId") as string;

  if (!file || file.size === 0) return { error: "No se seleccionó ningún archivo válido" };

  try {
    const uploadsDir = resolve(process.cwd(), "public", "uploads");

    // Ensure directory exists recursively
    await mkdir(uploadsDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename to prevent relative paths or malicious character uploads
    const cleanFilename = basename(file.name).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const safeFilename = `${Date.now()}-${cleanFilename}`;
    const path = join(uploadsDir, safeFilename);

    if (!path.startsWith(uploadsDir)) {
      return { error: "Acceso denegado: nombre de archivo inválido" };
    }

    await writeFile(path, buffer);

    const document = await prisma.document.create({
      data: {
        name: file.name,
        url: `/uploads/${safeFilename}`,
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
    if (caseId) revalidatePath(`/people/${personId || 'any'}`);

    return { success: true, fileName: file.name };
  } catch (error: any) {
    console.error("UPLOAD_ERROR:", error);
    return { error: `Error en el servidor: ${error.message || "Fallo desconocido"}` };
  }
}
