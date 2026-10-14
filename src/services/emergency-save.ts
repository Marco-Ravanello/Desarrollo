import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { syncPersonInDatabase, getEmergencyOperator, getStormVictimRecords } from "@/services/emergency";
import { StormVictimItem } from "@/types/emergency";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords, isEmergencySurveyor } from "@/lib/permissions";
import { isEmergencyDbUpdated, stormRecordOmit } from "@/services/emergency-db-status";

export interface EmergencySessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  areaId?: string | null;
}

export type SaveStormVictimResult =
  | { success: true; record: any; caseId: string | null; message: string; duplicate?: boolean }
  | { success: false; error: string };

/**
 * Guarda una ficha de tormenta (alta o edición). La usan la server action y la
 * API que recibe las fichas cargadas sin conexión.
 * - `clientId`: si ya existe una ficha con ese identificador, no se duplica.
 * - El relevador de emergencia solo puede editar las fichas que cargó.
 */
export async function saveStormVictimRecord(
  user: EmergencySessionUser | undefined | null,
  recordData: Partial<StormVictimItem>
): Promise<SaveStormVictimResult> {
  if (user && !canEditSocialRecords(user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!user?.id) {
    return { success: false, error: "Sesión no válida o expirada" };
  }
  const userId = user.id;
  const surveyor = isEmergencySurveyor(user.role);
  // Sin la actualización de la base, las fichas se guardan como antes (sin dueño ni control de duplicados).
  const dbUpdated = await isEmergencyDbUpdated();
  const omit = await stormRecordOmit();
  const clientId = dbUpdated && typeof recordData.clientId === "string" && recordData.clientId.trim() ? recordData.clientId.trim().slice(0, 100) : null;

  try {
    // Una ficha cargada sin conexión que ya llegó: se devuelve la existente.
    if (clientId && !recordData.id) {
      const existing = await prisma.stormVictimRecord.findUnique({ where: { clientId } });
      if (existing) {
        return { success: true, record: existing, caseId: existing.caseId, message: "La ficha ya estaba guardada", duplicate: true };
      }
    }

    if (recordData.id && surveyor) {
      const owned = await prisma.stormVictimRecord.findUnique({ where: { id: recordData.id }, select: { createdById: true } });
      if (!owned || owned.createdById !== userId) {
        return { success: false, error: "Solo podés modificar las fichas que cargaste vos." };
      }
    }

    const operator = await getEmergencyOperator(user);

    const personId = await syncPersonInDatabase({
      dni: recordData.dni || "",
      nombreApellido: recordData.nombreApellido || "Vecino Registrado",
      domicilio: recordData.domicilio,
      contacto: recordData.contacto || undefined,
    });

    const defaultArea = await prisma.area.findFirst({
      where: {
        OR: [
          { id: operator.areaId },
          { name: { contains: "Desarrollo", mode: "insensitive" } },
          { name: { contains: "Hábitat", mode: "insensitive" } },
          { name: { contains: "Social", mode: "insensitive" } },
        ],
      },
    }) || await prisma.area.findFirst();

    if (!defaultArea) {
      return { success: false, error: "No se encontró un área administrativa para imputar la asistencia." };
    }

    const itemElements: string[] = [];
    if (recordData.requiereColchon && recordData.cantidadColchon) itemElements.push(`${recordData.cantidadColchon} Colchón(es)`);
    if (recordData.requiereCama && recordData.cantidadCama) itemElements.push(`${recordData.cantidadCama} Cama(s)`);
    if (recordData.requiereCucheta && recordData.cantidadCucheta) itemElements.push(`${recordData.cantidadCucheta} Cucheta(s)`);
    if (recordData.requiereFrazada && recordData.cantidadFrazada) itemElements.push(`${recordData.cantidadFrazada} Frazada(s)`);

    const elementsSummary = itemElements.length > 0 ? itemElements.join(", ") : "Sin solicitud inmediata de mobiliario";

    const caseTitle = `[CONTINGENCIA TORMENTA] Asistencia a ${recordData.nombreApellido} - ${recordData.barrio || recordData.domicilio}`;
    const caseDescription = `Relevamiento territorial de contingencia registrado por ${operator.name} (${operator.areaName}). Domicilio: ${recordData.domicilio} (Ref: ${recordData.referencia || "N/A"}). Afectados: Grupo Familiar: ${recordData.grupoFamiliar ? "Sí" : "No"}, Niños: ${recordData.ninos || "0"}. Elementos solicitados: ${elementsSummary}. Intervención: ${recordData.descripcionIntervencion || "Asistencia social en territorio"}.`;

    let priorityEnum: "ALTA" | "MEDIA" | "BAJA" = "MEDIA";
    if (recordData.prioridad === "ALTA") priorityEnum = "ALTA";
    if (recordData.prioridad === "BAJA") priorityEnum = "BAJA";

    const activeCaseId = recordData.caseId;

    if (recordData.id) {
      // UPDATE CASE & INTERVENTION FIRST
      if (activeCaseId) {
        try {
          await prisma.case.update({
            where: { id: activeCaseId },
            data: {
              title: caseTitle,
              description: caseDescription,
              priority: priorityEnum,
              personId: personId,
            },
          });
        } catch (cErr) {
          console.warn("Could not update case in DB:", cErr);
        }
      }

      if (activeCaseId) {
        try {
          await prisma.intervention.create({
            data: {
              caseId: activeCaseId,
              personId: personId,
              userId,
              description: `Actualización de Ficha Tormenta por ${operator.name}. Requerimientos: ${elementsSummary}.`,
            },
          });
        } catch (iErr) {
          console.warn("Could not create intervention in DB:", iErr);
        }
      }

      let updatedRecord: any = null;
      try {
        updatedRecord = await prisma.stormVictimRecord.update({
          where: { id: recordData.id },
          omit,
          data: {
            personId: personId,
            nombreApellido: recordData.nombreApellido || "Vecino Afectado",
            dni: recordData.dni || null,
            edad: recordData.edad || null,
            grupoFamiliar: recordData.grupoFamiliar || false,
            ninos: recordData.ninos || "0",
            domicilio: recordData.domicilio || "Sin especificación",
            referencia: recordData.referencia || null,
            barrio: recordData.barrio || null,
            requiereColchon: recordData.requiereColchon || false,
            cantidadColchon: Number(recordData.cantidadColchon) || 0,
            requiereCama: recordData.requiereCama || false,
            cantidadCama: Number(recordData.cantidadCama) || 0,
            requiereCucheta: recordData.requiereCucheta || false,
            cantidadCucheta: Number(recordData.cantidadCucheta) || 0,
            requiereFrazada: recordData.requiereFrazada || false,
            cantidadFrazada: Number(recordData.cantidadFrazada) || 0,
            observaciones: recordData.observaciones || null,
            contacto: recordData.contacto || null,
            agentes: recordData.agentes || operator.name,
            prioridad: recordData.prioridad || "MEDIA",
            descripcionIntervencion: recordData.descripcionIntervencion || null,
          },
        });
      } catch (stormErr) {
        console.warn("StormVictimRecord update skipped/failed:", stormErr);
      }

      const allRecords = await getStormVictimRecords();
      const recordToSave = updatedRecord || {
        ...recordData,
        id: recordData.id,
        personId,
        caseId: activeCaseId,
      };
      const updatedList = allRecords.map((r) => (r.id === recordData.id ? recordToSave : r));

      await prisma.systemSetting.upsert({
        where: { key: "muni-storm-records-backup" },
        update: { value: JSON.stringify(updatedList) },
        create: { key: "muni-storm-records-backup", value: JSON.stringify(updatedList) },
      });

      revalidateEmergencyPaths();

      return {
        success: true,
        record: recordToSave,
        caseId: activeCaseId || null,
        message: "Expediente y persona registrados correctamente",
      };
    }

    // CREATE NEW CASE & INTERVENTION FIRST
    let createdCase: any = null;
    try {
      createdCase = await prisma.case.create({
        data: {
          title: caseTitle,
          description: caseDescription,
          status: "ABIERTO",
          priority: priorityEnum,
          personId: personId,
          areaId: defaultArea.id,
        },
      });

      await prisma.intervention.create({
        data: {
          caseId: createdCase.id,
          personId: personId,
          userId,
          description: `Entrevista e inspección técnica de contingencia climática por ${operator.name}. Requerimientos: ${elementsSummary}. Detalle: ${recordData.descripcionIntervencion || "Sin observaciones adicionales"}`,
        },
      });
    } catch (cErr) {
      console.warn("Error creating case or intervention:", cErr);
    }

    const existingRecords = await getStormVictimRecords();
    const recordFields = {
      itemNumber: recordData.itemNumber || existingRecords.length + 1,
      personId: personId,
      nombreApellido: recordData.nombreApellido || "Vecino Afectado",
      dni: recordData.dni || null,
      edad: recordData.edad || null,
      grupoFamiliar: recordData.grupoFamiliar || false,
      ninos: recordData.ninos || "0",
      domicilio: recordData.domicilio || "Sin especificación",
      referencia: recordData.referencia || null,
      barrio: recordData.barrio || null,
      requiereColchon: recordData.requiereColchon || false,
      cantidadColchon: Number(recordData.cantidadColchon) || 0,
      requiereCama: recordData.requiereCama || false,
      cantidadCama: Number(recordData.cantidadCama) || 0,
      requiereCucheta: recordData.requiereCucheta || false,
      cantidadCucheta: Number(recordData.cantidadCucheta) || 0,
      requiereFrazada: recordData.requiereFrazada || false,
      cantidadFrazada: Number(recordData.cantidadFrazada) || 0,
      observaciones: recordData.observaciones || null,
      contacto: recordData.contacto || null,
      agentes: recordData.agentes || operator.name,
      prioridad: recordData.prioridad || "MEDIA",
      descripcionIntervencion: recordData.descripcionIntervencion || null,
      estado: "REGISTRADO",
      caseId: createdCase?.id || null,
      ...(dbUpdated ? { createdById: userId, clientId } : {}),
    };

    let createdRecord: any = null;
    try {
      createdRecord = await prisma.stormVictimRecord.create({ data: recordFields, omit });
    } catch (stormErr: any) {
      // Dos envíos simultáneos de la misma ficha: gana el primero.
      if (clientId && stormErr?.code === "P2002") {
        const existing = await prisma.stormVictimRecord.findUnique({ where: { clientId } });
        if (existing) {
          if (createdCase?.id) {
            await prisma.intervention.deleteMany({ where: { caseId: createdCase.id } }).catch(() => {});
            await prisma.case.delete({ where: { id: createdCase.id } }).catch(() => {});
          }
          return { success: true, record: existing, caseId: existing.caseId, message: "La ficha ya estaba guardada", duplicate: true };
        }
      }
      console.warn("StormVictimRecord create skipped/failed (table may not exist yet):", stormErr);
    }

    const recordToSave = createdRecord || {
      id: `temp-${Date.now()}`,
      ...recordFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedRecords = [recordToSave, ...existingRecords];
    await prisma.systemSetting.upsert({
      where: { key: "muni-storm-records-backup" },
      update: { value: JSON.stringify(updatedRecords) },
      create: { key: "muni-storm-records-backup", value: JSON.stringify(updatedRecords) },
    });

    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "STORM_VICTIM_REGISTERED",
          entity: "StormVictimRecord",
          entityId: recordToSave.id,
          details: `Carga de damnificado por tormenta: ${recordData.nombreApellido} (DNI ${recordData.dni || "S/D"}). Caso N° ${createdCase?.id || "Backup"} generado en ${defaultArea.name}.${clientId ? " Cargada desde el dispositivo del relevamiento." : ""}`,
        },
      });
    } catch (auditErr) {
      console.warn("AuditLog creation skipped:", auditErr);
    }

    revalidateEmergencyPaths();

    return {
      success: true,
      record: recordToSave,
      caseId: createdCase?.id || null,
      message: "Expediente y persona registrados correctamente",
    };
  } catch (err: any) {
    console.error("Error saving storm victim record:", err);
    return { success: false, error: actionErrorMessage(err, "No se pudo registrar la ficha de tormenta") };
  }
}

function revalidateEmergencyPaths() {
  revalidatePath("/admin/emergency");
  revalidatePath("/cases");
  revalidatePath("/dashboard");
}
