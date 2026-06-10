"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";

export async function addFamilyMember(personId: string, memberDni: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  // 1. Buscar a la persona que se quiere agregar
  const member = await prisma.person.findUnique({
    where: { dni: memberDni }
  });

  if (!member) {
    throw new Error("No se encontró ninguna persona con ese DNI. Debe registrarla primero.");
  }

  // 2. Obtener la persona actual y su familyId
  const person = await prisma.person.findUnique({
    where: { id: personId }
  });

  if (!person) throw new Error("Persona no encontrada");

  let familyId = person.familyId;

  // 3. Si la persona actual no tiene familia, crear una
  if (!familyId) {
    const newFamily = await prisma.family.create({
      data: { name: `Familia ${person.lastName}` }
    });
    familyId = newFamily.id;

    // Actualizar a la persona actual con el nuevo familyId
    await prisma.person.update({
      where: { id: personId },
      data: { familyId }
    });
  }

  // 4. Vincular al nuevo miembro a esa familia
  await prisma.person.update({
    where: { id: member.id },
    data: { familyId }
  });

  await createAuditLog(
    session.user.id,
    "ADD_FAMILY_MEMBER",
    "Family",
    familyId!,
    { personId, memberDni, memberName: `${member.firstName} ${member.lastName}` }
  );

  revalidatePath(`/people/${personId}`);
  return { success: true };
}

export async function removeFromFamily(personId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  await prisma.person.update({
    where: { id: personId },
    data: { familyId: null, isFamilyHead: false }
  });

  revalidatePath(`/people/${personId}`);
  return { success: true };
}
