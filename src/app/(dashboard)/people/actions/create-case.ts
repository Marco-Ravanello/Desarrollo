"use server";

import { createCase } from "@/services/cases";
import { ensurePersonInPrisma } from "@/services/people";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { createNotification } from "@/services/notifications";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords } from "@/lib/permissions";

export async function createCaseAction(formData: FormData) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user) return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  const personId = formData.get("personId") as string;
  const areaId = formData.get("areaId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  try {
    const person = await ensurePersonInPrisma(personId);
    if (!person) return { error: "No se encontró el ciudadano para asociar el caso" };

    const newCase = await createCase({
      personId: person.id,
      areaId,
      title,
      description
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'CREATE_CASE',
        entity: 'Case',
        entityId: newCase.id,
        details: `Nuevo caso: ${title}`
      }
    });

    // Notificar al personal del área (SUPERADMIN para este demo)
    const admins = await prisma.user.findMany({ where: { role: 'SUPERADMIN' } });
    for (const admin of admins) {
      await createNotification(
        admin.id,
        "Nuevo Caso Abierto",
        `Se ha registrado un nuevo caso: "${title}"`,
        `/people/${person.id}`
      );
    }

    revalidatePath(`/people/${person.id}`);
    revalidatePath(`/people/${personId}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: actionErrorMessage(error, "No se pudo crear el caso") };
  }
}
