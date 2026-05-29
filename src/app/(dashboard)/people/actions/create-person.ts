"use server";

import { createPerson } from "@/services/people";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createPersonAction(formData: FormData) {
  const session = await auth();
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
      return { success: false, error: "Ya existe una persona registrada con ese DNI" };
    }
    return { success: false, error: "Ocurrió un error al guardar en la base de datos" };
  }
}
