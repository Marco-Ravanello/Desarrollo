"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ensurePersonInPrisma } from "@/services/people";
import { makeStoredName, saveUploadedFile, uploadUrl } from "@/lib/file-storage";
import { actionErrorMessage } from "@/lib/action-error";
import { setDocumentExpiry } from "@/services/document-expiry";
import { canEditSocialRecords } from "@/lib/permissions";
import { checkExpiry, documentNameWithoutFile, isDocumentKind, type DocumentKind } from "@/lib/document-kinds";
import { todayInArgentina } from "@/lib/follow-up-dates";

export async function uploadDocumentAction(formData: FormData) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user) return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  const file = formData.get("file") as File | null;
  const personId = formData.get("personId") as string;
  const caseId = formData.get("caseId") as string;
  const kind = isDocumentKind(formData.get("kind")) ? (formData.get("kind") as DocumentKind) : null;
  const expiry = checkExpiry(formData.get("expiresAt"), todayInArgentina());
  if ("error" in expiry) return { error: expiry.error };
  const hasFile = Boolean(file && typeof file !== "string" && file.size > 0);

  // Sin archivo se puede anotar solo el vencimiento (por ejemplo, "el CUD vence el 12/03/2027").
  if (!hasFile && !(kind && expiry.day)) return { error: "Elegí un archivo, o el tipo de documento y cuándo vence." };

  try {
    let validPersonId = null;
    if (personId) {
      const person = await ensurePersonInPrisma(personId);
      validPersonId = person ? person.id : null;
    }

    let url: string | null = null;
    if (hasFile) {
      const buffer = Buffer.from(await file!.arrayBuffer());
      const storedName = makeStoredName(file!.name);
      await saveUploadedFile(storedName, buffer, file!.type);
      url = uploadUrl(storedName);
    }
    const name = hasFile ? file!.name : documentNameWithoutFile(kind!);

    const document = await prisma.document.create({
      data: {
        name,
        url,
        fileType: hasFile ? file!.type : null,
        personId: validPersonId,
        caseId: caseId || null,
        kind,
        expiresAt: expiry.day ? new Date(`${expiry.day}T00:00:00.000Z`) : null,
        uploadedById: session.user.id ?? null,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'UPLOAD_DOCUMENT',
        entity: 'Document',
        entityId: document.id,
        details: hasFile
          ? `Archivo subido: ${name}${expiry.day ? ` (vence el ${expiry.day.split("-").reverse().join("/")})` : ""}`
          : `Anotó ${name} sin archivo, vence el ${expiry.day!.split("-").reverse().join("/")}`
      }
    });

    if (personId) revalidatePath(`/people/${personId}`);
    if (validPersonId) revalidatePath(`/people/${validPersonId}`);
    if (caseId) revalidatePath(`/people/${personId || 'any'}`);

    return { success: true, fileName: name };
  } catch (error: any) {
    console.error("UPLOAD_ERROR:", error);
    return { error: actionErrorMessage(error, "No se pudo subir el documento") };
  }
}

/** Cambia el tipo y el vencimiento de un documento (por ejemplo, al renovar el CUD). */
export async function setDocumentExpiryAction(id: string, kind: string, day: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const result = await setDocumentExpiry(session.user, id, { kind, day });
    if (result.success && result.dni) revalidatePath(`/people/${result.dni}`);
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo guardar el vencimiento") };
  }
}
