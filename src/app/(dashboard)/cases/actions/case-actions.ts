"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getPeople, ensurePersonInPrisma } from "@/services/people";

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
    if (!caseItem.personId) {
      return { success: false, error: "El expediente debe tener un ciudadano asignado para registrar una intervención." };
    }

    const validPerson = await ensurePersonInPrisma(caseItem.personId);
    if (!validPerson) {
      return { success: false, error: "No se encontró el registro del ciudadano en la base de datos." };
    }

    const intervention = await prisma.intervention.create({
      data: {
        caseId,
        personId: validPerson.id,
        description: cleanDesc,
        userId: session.user.id,
        date: new Date()
      }
    });

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

export async function searchCitizensAction(query: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado", items: [] };
  }

  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return { success: true, items: [] };
  }

  try {
    const people = await getPeople(cleanQuery, 8);
    const sanitized = people.map((p) => ({
      id: p.id,
      dni: p.dni,
      firstName: p.firstName,
      lastName: p.lastName,
      address: p.address || null,
      barrio: (p as any).barrio || null,
      phone: p.phone || null,
      email: p.email || null,
      programasActivos: (p as any).programasActivos || []
    }));

    return { success: true, items: sanitized };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al buscar ciudadanos", items: [] };
  }
}

export interface CreateCentralizedCaseInput {
  title: string;
  description?: string;
  areaId: string;
  priority?: "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
  dni: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export async function createCentralizedCaseAction(input: CreateCentralizedCaseInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado" };
  }

  const cleanTitle = input.title?.trim();
  const cleanDni = input.dni?.trim();
  const cleanAreaId = input.areaId?.trim();

  if (!cleanTitle || !cleanDni || !cleanAreaId) {
    return { success: false, error: "Título, DNI del ciudadano y Área responsable son obligatorios" };
  }

  try {
    let person = await ensurePersonInPrisma(cleanDni);
    if (!person) {
      person = await prisma.person.create({
        data: {
          dni: cleanDni,
          firstName: input.firstName?.trim() || "Ciudadano",
          lastName: input.lastName?.trim() || "Registrado",
          address: input.address?.trim() || undefined,
          phone: input.phone?.trim() || undefined,
          email: input.email?.trim() || undefined
        }
      });
    }

    const newCase = await prisma.case.create({
      data: {
        title: cleanTitle,
        description: input.description?.trim() || undefined,
        areaId: cleanAreaId,
        personId: person.id,
        status: "ABIERTO",
        priority: input.priority || "MEDIA"
      }
    });

    if (input.description?.trim()) {
      await prisma.intervention.create({
        data: {
          caseId: newCase.id,
          personId: person.id,
          description: input.description.trim(),
          userId: session.user.id,
          date: new Date()
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_CASE",
        entity: "Case",
        entityId: newCase.id,
        details: `Apertura centralizada de expediente '${newCase.title}' para ciudadano DNI ${person.dni}`
      }
    });

    revalidatePath("/cases");
    revalidatePath(`/cases/${newCase.id}`);
    revalidatePath(`/people/${person.id}`);
    revalidatePath("/areas/social");
    revalidatePath("/areas/habitat");
    revalidatePath("/areas/ninez");
    revalidatePath("/areas/violence");

    return {
      success: true,
      caseId: newCase.id,
      title: newCase.title,
      personId: person.id
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al crear el expediente centralizado" };
  }
}

export async function createDerivationAction(
  caseId: string,
  toAreaId: string,
  reason: string,
  observations?: string
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };
  try {
    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      include: { area: true, person: true }
    });
    if (!caseItem) return { success: false, error: "Expediente no encontrado" };

    const derivation = await prisma.derivation.create({
      data: {
        caseId,
        fromAreaId: caseItem.areaId,
        toAreaId,
        reason: reason.trim(),
        observations: observations?.trim() || null,
        status: "PENDIENTE"
      }
    });

    await prisma.case.update({
      where: { id: caseId },
      data: { status: "DERIVADO" }
    });

    const destinationUsers = await prisma.user.findMany({
      where: { areaId: toAreaId, isActive: true },
      select: { id: true }
    });

    if (destinationUsers.length > 0) {
      await prisma.notification.createMany({
        data: destinationUsers.map((u) => ({
          userId: u.id,
          title: "Expediente Derivado Urgente",
          message: `El área ${caseItem.area.name} ha derivado el expediente '${caseItem.title}' para su intervención.`,
          link: `/cases/${caseId}`
        }))
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CASE_DERIVATION_CREATED",
        entity: "Derivation",
        entityId: derivation.id,
        details: `Caso derivado de ${caseItem.area.name} al área ID ${toAreaId}. Motivo: ${reason}`
      }
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath("/cases");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar derivación" };
  }
}
