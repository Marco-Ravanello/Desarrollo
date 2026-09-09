"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getPeople } from "@/services/people";

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
    let person = await prisma.person.findUnique({
      where: { dni: cleanDni }
    });

    if (!person) {
      person = await prisma.person.create({
        data: {
          dni: cleanDni,
          firstName: input.firstName?.trim() || "Vecino",
          lastName: input.lastName?.trim() || "S/D",
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
