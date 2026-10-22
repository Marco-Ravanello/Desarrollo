"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { ensurePersonInPrisma } from "@/services/people";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords } from "@/lib/permissions";

export async function addFamilyMember(
  personId: string,
  memberDni: string,
  relationship: string = "Familiar a cargo"
) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const cleanDni = memberDni.trim().replace(/[^0-9]/g, "");
  if (!cleanDni) {
    return { success: false, error: "Escribí un DNI válido" };
  }

  // 1. Asegurar que ambos ciudadanos existan en la tabla Person
  const member = await ensurePersonInPrisma(cleanDni);
  if (!member) {
    return {
      success: false,
      error: `No se encontró ningún ciudadano con DNI ${cleanDni} en el padrón.`
    };
  }

  const person = await ensurePersonInPrisma(personId);
  if (!person) {
    return { success: false, error: "Persona principal no encontrada" };
  }

  if (person.id === member.id) {
    return { success: false, error: "No puede vincular a la persona consigo misma" };
  }

  let familyId = person.familyId;

  // Si la persona no tiene grupo familiar creado, crearlo
  if (!familyId) {
    const newFamily = await prisma.family.create({
      data: { name: `Grupo Familiar de ${person.lastName}` }
    });
    familyId = newFamily.id;

    await prisma.person.update({
      where: { id: person.id },
      data: { familyId, isFamilyHead: true }
    });
  }

  // Vincular al nuevo integrante
  await prisma.person.update({
    where: { id: member.id },
    data: { familyId }
  });

  await createAuditLog(
    session.user.id,
    "ADD_FAMILY_MEMBER",
    "Family",
    familyId,
    {
      personId: person.id,
      memberId: member.id,
      memberDni: cleanDni,
      relationship
    }
  );

  revalidatePath(`/people/${personId}`);
  revalidatePath(`/people/${person.id}`);
  return { success: true };
}

export async function removeFromFamily(personId: string) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  try {
    const person = await ensurePersonInPrisma(personId);
    if (person) {
      await prisma.person.update({
        where: { id: person.id },
        data: { familyId: null, isFamilyHead: false }
      });
      revalidatePath(`/people/${person.id}`);
    }
    revalidatePath(`/people/${personId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: actionErrorMessage(err, "No se pudo desvincular familiar") };
  }
}
