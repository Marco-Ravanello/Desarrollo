"use server";

import { createPerson, findExistingPersonByDni } from "@/services/people";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords } from "@/lib/permissions";

type CreatePersonResult =
  | { success: true; id: string }
  | { success: false; error: string; existingId?: string };

export async function createPersonAction(formData: FormData): Promise<CreatePersonResult> {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  const dni = formData.get("dni") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const birthDate = formData.get("birthDate") as string;
  const address = formData.get("address") as string;
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string;

  if (!dni || !firstName || !lastName) {
    return { success: false, error: "DNI y nombre completo son requeridos" };
  }

  try {
    // Si ya está cargada no se toca: se avisa y se ofrece ir a su ficha (para corregir datos está "Editar").
    const existing = await findExistingPersonByDni(dni);
    if (existing) {
      return {
        success: false,
        error: `Esta persona ya está cargada: ${existing.nombre} (DNI ${dni.trim()}). No se cambió nada.`,
        existingId: existing.id,
      };
    }

    const person = await createPerson({
      dni,
      firstName,
      lastName,
      birthDate,
      address,
      phone,
      email,
    });

    if (session?.user?.id) {
      await createAuditLog(session.user.id, "CREATE", "Person", person.id, { dni: person.dni });
    }

    revalidatePath("/people");
    return { success: true, id: person.id };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: "Esta persona ya está cargada. No se cambió nada." };
    }
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar la persona") };
  }
}
