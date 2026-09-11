"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function updatePersonAction(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado" };
  }

  const dni = (formData.get("dni") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const birthDateStr = formData.get("birthDate") as string;

  if (!dni || !firstName || !lastName) {
    return { success: false, error: "DNI, Nombre y Apellido son obligatorios" };
  }

  // Verificar que el DNI no pertenezca a otra persona
  const existingPersonWithDni = await prisma.person.findFirst({
    where: {
      dni,
      NOT: { OR: [{ id }, { dni: id }] }
    }
  });

  if (existingPersonWithDni) {
    return { success: false, error: `El DNI ${dni} ya pertenece a otro ciudadano (${existingPersonWithDni.lastName}, ${existingPersonWithDni.firstName})` };
  }

  try {
    const birthDate = birthDateStr ? new Date(birthDateStr) : null;

    let targetPerson = await prisma.person.findFirst({
      where: { OR: [{ id }, { dni: id }, { dni }] }
    });

    let updatedPerson;
    if (targetPerson) {
      updatedPerson = await prisma.person.update({
        where: { id: targetPerson.id },
        data: {
          dni,
          firstName,
          lastName,
          address,
          phone,
          email,
          birthDate
        }
      });
    } else {
      updatedPerson = await prisma.person.create({
        data: {
          id,
          dni,
          firstName,
          lastName,
          address,
          phone,
          email,
          birthDate
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Person",
        entityId: updatedPerson.id,
        details: `Actualización de datos del ciudadano: ${updatedPerson.lastName}, ${updatedPerson.firstName} (DNI: ${updatedPerson.dni})`
      }
    });

    revalidatePath(`/people/${id}`);
    revalidatePath(`/people/${updatedPerson.id}`);
    revalidatePath("/people");
    revalidatePath("/ficha-social");
    revalidatePath("/maps");

    return { success: true, person: updatedPerson };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return { success: false, error: "El DNI ingresado ya existe en la base de datos." };
    }
    return { success: false, error: error.message || "Error al actualizar ciudadano" };
  }
}
