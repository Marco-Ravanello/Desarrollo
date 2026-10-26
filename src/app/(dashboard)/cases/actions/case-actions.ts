"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getPeople, ensurePersonInPrisma } from "@/services/people";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords } from "@/lib/permissions";
import { createDerivation, respondDerivation } from "@/services/derivations";
import { editIntervention } from "@/services/interventions";
import { assignCase } from "@/services/case-assignment";
import { completeFollowUp, scheduleFollowUp } from "@/services/follow-ups";
import { isInterventionType } from "@/lib/intervention-types";
import { normalizeCaseLabels } from "@/lib/case-labels";
import { updateCaseLabels } from "@/services/case-labels";

export async function addCaseInterventionAction(caseId: string, description: string, type?: string) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const cleanDesc = description?.trim();
  if (!cleanDesc) {
    return { success: false, error: "La descripción de la intervención no puede estar vacía" };
  }
  if (type !== undefined && !isInterventionType(type)) {
    return { success: false, error: "Elegí el tipo de intervención." };
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
      return { success: false, error: "El expediente no tiene titular: cargalo antes de registrar una intervención." };
    }

    const validPerson = await ensurePersonInPrisma(caseItem.personId);
    if (!validPerson) {
      return { success: false, error: "No se encontró a la persona titular del expediente." };
    }

    const intervention = await prisma.intervention.create({
      data: {
        caseId,
        personId: validPerson.id,
        description: cleanDesc,
        type: type && isInterventionType(type) ? type : null,
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
    return { success: false, error: actionErrorMessage(error, "No se pudo registrar la intervención") };
  }
}

export async function searchCitizensAction(query: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión.", items: [] };
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
    return { success: false, error: actionErrorMessage(error, "No se pudo buscar a la persona"), items: [] };
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
  /** Claves de src/lib/case-labels.ts; las que no son de la lista se ignoran. */
  labels?: string[];
}

export async function createCentralizedCaseAction(input: CreateCentralizedCaseInput) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const cleanTitle = input.title?.trim();
  const cleanDni = input.dni?.trim();
  const cleanAreaId = input.areaId?.trim();

  if (!cleanTitle || !cleanDni || !cleanAreaId) {
    return { success: false, error: "Completá la carátula, el DNI del titular y el área." };
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
        priority: input.priority || "MEDIA",
        labels: normalizeCaseLabels(input.labels),
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
        details: `Apertura centralizada de expediente '${newCase.title}' para DNI ${person.dni}`
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
    return { success: false, error: actionErrorMessage(error, "No se pudo crear el expediente centralizado") };
  }
}

export async function createDerivationAction(
  caseId: string,
  toAreaId: string,
  reason: string,
  observations?: string
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  try {
    const result = await createDerivation(session.user, { caseId, toAreaId, reason, observations });
    if (result.success) revalidateDerivation(caseId);
    return result;
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo registrar la derivación") };
  }
}

/** El área que recibe la derivación la acepta (el expediente pasa a ser suyo) o la rechaza con un motivo. */
export async function respondDerivationAction(derivationId: string, accept: boolean, response?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  try {
    const result = await respondDerivation(session.user, { derivationId, accept, response });
    if (result.success) {
      const d = await prisma.derivation.findUnique({ where: { id: derivationId }, select: { caseId: true } });
      if (d) revalidateDerivation(d.caseId);
    }
    return result;
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo responder la derivación") };
  }
}

/** Deja a una persona a cargo del expediente (o lo deja sin profesional, con null). */
export async function assignCaseAction(caseId: string, assigneeId: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  try {
    const result = await assignCase(session.user, { caseId, assigneeId: assigneeId || null });
    if (result.success) revalidateDerivation(caseId);
    return result;
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo asignar el expediente") };
  }
}

function revalidateDerivation(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/cases/derivaciones");
  revalidatePath("/dashboard");
}

/** Quien cargó una intervención la corrige el mismo día; la versión anterior queda guardada. */
export async function editCaseInterventionAction(interventionId: string, description: string, type: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const result = await editIntervention(session.user, { interventionId, description, type });
    if (result.success) {
      const i = await prisma.intervention.findUnique({ where: { id: interventionId }, select: { caseId: true, personId: true } });
      if (i) {
        revalidatePath(`/cases/${i.caseId}`);
        revalidatePath(`/people/${i.personId}`);
      }
    }
    return result;
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo corregir la intervención") };
  }
}

export async function scheduleFollowUpAction(caseId: string, day: string, note?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  try {
    const result = await scheduleFollowUp(session.user, { caseId, day, note });
    if (result.success) {
      revalidatePath(`/cases/${caseId}`);
      revalidatePath("/tasks");
      revalidatePath("/dashboard");
    }
    return result;
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo agendar el seguimiento") };
  }
}

export async function completeFollowUpAction(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  try {
    const result = await completeFollowUp(session.user, taskId);
    if (result.success) {
      if (result.caseId) revalidatePath(`/cases/${result.caseId}`);
      revalidatePath("/tasks");
      revalidatePath("/dashboard");
    }
    return { success: result.success, error: result.success ? undefined : result.error };
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo marcar el seguimiento") };
  }
}

/** Cambia las etiquetas del expediente (adulto mayor, discapacidad…). */
export async function updateCaseLabelsAction(caseId: string, labels: string[]) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }
  try {
    const result = await updateCaseLabels(session.user, caseId, labels);
    if (result.success) {
      revalidatePath(`/cases/${caseId}`);
      revalidatePath("/cases");
    }
    return result;
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudieron guardar las etiquetas") };
  }
}
