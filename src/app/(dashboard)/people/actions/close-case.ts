"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";

export async function closeCaseAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  try {
    const closedCase = await prisma.case.update({
      where: { id },
      data: { status: 'CERRADO' }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'CLOSE_CASE',
        entity: 'Case',
        entityId: id,
        details: `Caso cerrado: ${closedCase.title}`
      }
    });

    revalidatePath(`/people/${closedCase.personId}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: actionErrorMessage(error, "No se pudo cerrar el caso") };
  }
}
