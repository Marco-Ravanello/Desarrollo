"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addCaseInterventionAction(caseId: string, description: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado" };
  }

  const cleanDesc = description?.trim();
  if (!cleanDesc) {
    return { success: false, error: "La descripción de la intervención no puede estar vacía" };
  }

  try {
    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, personId: true, status: true, title: true }
    });

    if (!caseItem) {
      return { success: false, error: "Expediente no encontrado" };
    }

    const intervention = await prisma.intervention.create({
      data: {
        caseId,
        personId: caseItem.personId,
        description: cleanDesc,
        userId: session.user.id,
        date: new Date()
      }
    });

    // Si el caso está en ABIERTO, pasarlo a EN_PROCESO, o simplemente actualizar updatedAt
    const newStatus = caseItem.status === "ABIERTO" ? "EN_PROCESO" : caseItem.status;

    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: newStatus as any,
        updatedAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_INTERVENTION",
        entity: "Case",
        entityId: caseId,
        details: `Carga rápida de intervención social en expediente ${caseItem.title}`
      }
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath(`/people/${caseItem.personId}`);

    return { success: true, intervention };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar la intervención" };
  }
}
