"use server";

import { createCase } from "@/services/cases";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { createNotification } from "@/app/(dashboard)/actions/notifications";

export async function createCaseAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const personId = formData.get("personId") as string;
  const areaId = formData.get("areaId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  try {
    const newCase = await createCase({
      personId,
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
        `/people/${personId}`
      );
    }

    revalidatePath(`/people/${personId}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error al crear el caso" };
  }
}
