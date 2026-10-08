"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  searchPeopleForEmergency,
  syncPersonInDatabase,
  getEmergencyOperator,
  getStormVictimRecords
} from "@/services/emergency";
import { StormVictimItem } from "@/types/emergency";

export async function searchPeopleForEmergencyAction(query: string) {
  return await searchPeopleForEmergency(query);
}

export async function saveStormVictimAction(recordData: Partial<StormVictimItem>) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Sesión no válida o expirada" };
  }

  try {
    const operator = await getEmergencyOperator(session.user);

    const personId = await syncPersonInDatabase({
      dni: recordData.dni || "",
      nombreApellido: recordData.nombreApellido || "Vecino Registrado",
      domicilio: recordData.domicilio,
      contacto: recordData.contacto || undefined,
    });

    let defaultArea = await prisma.area.findFirst({
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

    let activeCaseId = recordData.caseId;

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
              userId: session.user.id,
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

      revalidatePath("/admin/emergency");
      revalidatePath("/cases");
      revalidatePath("/dashboard");

      return {
        success: true,
        record: recordToSave,
        caseId: activeCaseId,
        message: "Expediente y persona registrados correctamente",
      };
    } else {
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
            userId: session.user.id,
            description: `Entrevista e inspección técnica de contingencia climática por ${operator.name}. Requerimientos: ${elementsSummary}. Detalle: ${recordData.descripcionIntervencion || "Sin observaciones adicionales"}`,
          },
        });
      } catch (cErr) {
        console.warn("Error creating case or intervention:", cErr);
      }

      const existingRecords = await getStormVictimRecords();
      let createdRecord: any = null;

      try {
        createdRecord = await prisma.stormVictimRecord.create({
          data: {
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
          },
        });
      } catch (stormErr) {
        console.warn("StormVictimRecord create skipped/failed (table may not exist yet):", stormErr);
      }

      const recordToSave = createdRecord || {
        id: `temp-${Date.now()}`,
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
            userId: session.user.id,
            action: "STORM_VICTIM_REGISTERED",
            entity: "StormVictimRecord",
            entityId: recordToSave.id,
            details: `Carga de damnificado por tormenta: ${recordData.nombreApellido} (DNI ${recordData.dni || 'S/D'}). Caso N° ${createdCase?.id || 'Backup'} generado en ${defaultArea.name}.`,
          },
        });
      } catch (auditErr) {
        console.warn("AuditLog creation skipped:", auditErr);
      }

      revalidatePath("/admin/emergency");
      revalidatePath("/cases");
      revalidatePath("/dashboard");

      return {
        success: true,
        record: recordToSave,
        caseId: createdCase?.id || null,
        message: "Expediente y persona registrados correctamente",
      };
    }
  } catch (err: any) {
    console.error("Error saving storm victim action:", err);
    return { success: false, error: err.message || "Error al registrar la ficha de tormenta" };
  }
}

export async function deleteStormVictimAction(recordId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  const cleanId = recordId.replace(/^case-/, "").replace(/^temp-/, "");

  try {
    // 1. Delete associated interventions if it corresponds to a Case
    try {
      await prisma.intervention.deleteMany({
        where: { caseId: cleanId }
      });
    } catch (e) {
      console.warn("Notice: Interventions deletion skipped or not found:", e);
    }

    // 2. Try deleting Case directly or updating status to CERRADO
    try {
      await prisma.case.delete({
        where: { id: cleanId }
      });
    } catch (caseErr) {
      try {
        await prisma.case.update({
          where: { id: cleanId },
          data: { status: "CERRADO" }
        });
      } catch (closeErr) {
        console.warn("Notice: Case update/delete skipped:", closeErr);
      }
    }

    // 3. Try deleting StormVictimRecord safely if model exists
    try {
      if ((prisma as any).stormVictimRecord) {
        await (prisma as any).stormVictimRecord.deleteMany({
          where: {
            OR: [
              { id: recordId },
              { id: cleanId },
              { caseId: cleanId }
            ]
          }
        });
      }
    } catch (stormErr) {
      console.warn("Notice: StormVictimRecord deletion skipped:", stormErr);
    }

    // 4. Update memory / SystemSetting backup
    try {
      const existing = await getStormVictimRecords();
      const filtered = existing.filter(r => r.id !== recordId && r.id !== cleanId && r.caseId !== cleanId);

      await prisma.systemSetting.upsert({
        where: { key: "muni-storm-records-backup" },
        update: { value: JSON.stringify(filtered) },
        create: { key: "muni-storm-records-backup", value: JSON.stringify(filtered) },
      });
    } catch (settingErr) {
      console.warn("Notice: SystemSetting backup update skipped:", settingErr);
    }

    // 5. Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "STORM_VICTIM_DELETED",
          entity: "Case/StormVictimRecord",
          entityId: recordId,
          details: `Eliminación / Cierre de registro de planilla de tormenta (ID ${recordId}) por ${session.user.name || session.user.email}`,
        },
      });
    } catch (auditErr) {
      console.warn("Notice: Audit log skipped:", auditErr);
    }

    revalidatePath("/admin/emergency");
    revalidatePath("/cases");
    revalidatePath("/people");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteStormVictimAction:", err);
    return { success: false, error: err.message || "Error al eliminar el registro" };
  }
}

export async function updateEmergencyStockAction(
  supplyId: string,
  newStock: number,
  itemName?: string
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    const validStock = Math.max(0, Math.floor(newStock));

    let catKey = supplyId.toUpperCase();
    if (supplyId.includes("colchon")) catKey = "COLCHON";
    else if (supplyId.includes("cama")) catKey = "CAMA";
    else if (supplyId.includes("cucheta")) catKey = "CUCHETA";
    else if (supplyId.includes("frazada")) catKey = "FRAZADA";

    let overrides: Record<string, number> = {};
    try {
      const overrideSetting = await prisma.systemSetting.findUnique({
        where: { key: "muni-emergency-stock-overrides" },
      });
      if (overrideSetting?.value) {
        overrides = JSON.parse(overrideSetting.value);
      }
    } catch (e) {
      console.warn("Could not read overrides setting:", e);
    }

    if (["COLCHON", "CAMA", "CUCHETA", "FRAZADA"].includes(catKey)) {
      overrides[catKey] = validStock;
      await prisma.systemSetting.upsert({
        where: { key: "muni-emergency-stock-overrides" },
        update: { value: JSON.stringify(overrides) },
        create: { key: "muni-emergency-stock-overrides", value: JSON.stringify(overrides) },
      });
    }

    try {
      const existingItem = await prisma.supplyItem.findUnique({ where: { id: supplyId } });
      if (existingItem) {
        await prisma.supplyItem.update({
          where: { id: supplyId },
          data: { stock: validStock },
        });
      } else {
        let nameToUse = itemName || "Insumo de Contingencia";
        if (catKey === "COLCHON") nameToUse = "Colchones de Contingencia (1 plaza)";
        else if (catKey === "CAMA") nameToUse = "Camas / Elásticos de Emergencia";
        else if (catKey === "CUCHETA") nameToUse = "Cuchetas Superpuestas Reforzadas";
        else if (catKey === "FRAZADA") nameToUse = "Frazadas Térmicas Antialérgicas";

        await prisma.supplyItem.create({
          data: {
            id: supplyId.startsWith("stock-cat-") ? undefined : supplyId,
            name: nameToUse,
            description: "Stock de contingencia configurado manualmente",
            stock: validStock,
            minStock: 10,
          },
        });
      }
    } catch (dbErr) {
      console.warn("Notice: SupplyItem update skipped or handled via SystemSetting:", dbErr);
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "EMERGENCY_STOCK_UPDATE",
          entity: "SupplyItem/SystemSetting",
          entityId: supplyId,
          details: `Ajuste manual de stock de depósito: ${itemName || supplyId} fijado en ${validStock} unidades por ${session.user.name || session.user.email}`,
        },
      });
    } catch (auditErr) {
      console.warn("Notice: AuditLog skipped:", auditErr);
    }

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/stock");
    return { success: true, newStock: validStock };
  } catch (error: any) {
    console.error("Error updating emergency stock:", error);
    return { success: false, error: error.message || "Error al actualizar stock" };
  }
}

export async function createEmergencyStockItemAction(data: {
  name: string;
  availableStock: number;
  unit?: string;
  minStock?: number;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  if (!data.name || data.name.trim().length === 0) {
    return { success: false, error: "El nombre del insumo es obligatorio" };
  }

  try {
    const newItemId = `custom-supply-${Date.now()}`;
    const stockVal = Math.max(0, Math.floor(data.availableStock || 0));
    const minStockVal = Math.max(1, Math.floor(data.minStock || 5));
    const unitVal = data.unit?.trim() || "Unidades";

    let dbItem = null;
    try {
      dbItem = await prisma.supplyItem.create({
        data: {
          id: newItemId,
          name: data.name.trim(),
          description: data.description?.trim() || "Insumo registrado en contingencia climática",
          stock: stockVal,
          minStock: minStockVal,
        },
      });
    } catch (dbErr) {
      console.warn("SupplyItem create skipped/failed, persisting via SystemSetting:", dbErr);
    }

    // Persist in custom items backup in SystemSetting
    try {
      let customList: any[] = [];
      const customSetting = await prisma.systemSetting.findUnique({
        where: { key: "custom-emergency-stock-items" },
      });
      if (customSetting?.value) {
        customList = JSON.parse(customSetting.value);
      }

      const newItemObj = {
        id: dbItem?.id || newItemId,
        name: data.name.trim(),
        description: data.description?.trim() || "Insumo de contingencia climática",
        availableStock: stockVal,
        minStock: minStockVal,
        unit: unitVal,
      };

      customList.push(newItemObj);

      await prisma.systemSetting.upsert({
        where: { key: "custom-emergency-stock-items" },
        update: { value: JSON.stringify(customList) },
        create: { key: "custom-emergency-stock-items", value: JSON.stringify(customList) },
      });
    } catch (sErr) {
      console.warn("SystemSetting custom supply backup failed:", sErr);
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "EMERGENCY_STOCK_ITEM_CREATED",
          entity: "SupplyItem",
          entityId: dbItem?.id || newItemId,
          details: `Nuevo insumo registrado para emergencia climática: ${data.name.trim()} (${stockVal} ${unitVal}) por ${session.user.name || session.user.email}`,
        },
      });
    } catch (auditErr) {
      console.warn("AuditLog skipped:", auditErr);
    }

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/stock");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating emergency stock item:", error);
    return { success: false, error: error.message || "Error al registrar el insumo" };
  }
}

export async function dispatchEmergencyStockAction(
  supplyId: string,
  quantity: number = 10,
  victimInfo?: string
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    let item = await prisma.supplyItem.findUnique({ where: { id: supplyId } });

    if (!item) {
      let itemName = "Insumo de Contingencia";
      if (supplyId.includes("colchon")) itemName = "Colchones de Contingencia (1 plaza)";
      else if (supplyId.includes("cama")) itemName = "Camas / Elásticos de Emergencia";
      else if (supplyId.includes("cucheta")) itemName = "Cuchetas Superpuestas Reforzadas";
      else if (supplyId.includes("frazada")) itemName = "Frazadas Térmicas Antialérgicas";

      item = await prisma.supplyItem.create({
        data: {
          id: supplyId,
          name: itemName,
          description: "Mobiliario e insumos de emergencia climática",
          stock: 100,
          minStock: 20,
        },
      });
    }

    if (item.stock < quantity) {
      return { success: false, error: `Stock insuficiente en depósito (${item.stock} disponibles)` };
    }

    const updatedItem = await prisma.supplyItem.update({
      where: { id: item.id },
      data: { stock: Math.max(0, item.stock - quantity) }
    });

    await prisma.supplyRequest.create({
      data: {
        supplyId: item.id,
        quantity,
        userId: session.user.id,
        status: "ENTREGADO"
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EMERGENCY_STOCK_DISPATCH",
        entity: "SupplyItem",
        entityId: item.id,
        details: `Despacho directo COE a territorio: ${quantity} unidades de ${item.name}. ${victimInfo ? `Destino: ${victimInfo}` : ""}`,
      }
    });

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/stock");
    return { success: true, newStock: updatedItem.stock };
  } catch (error: any) {
    console.error("Error dispatching emergency stock:", error);
    return { success: false, error: error.message || "Error al despachar insumo" };
  }
}

export async function getEmergencyStatusAction() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "muni-emergency-mode" }
    });
    return { success: true, active: setting?.value === "true" };
  } catch (err) {
    return { success: true, active: false };
  }
}

export async function toggleEmergencyStatusAction(active: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };
  try {
    await prisma.systemSetting.upsert({
      where: { key: "muni-emergency-mode" },
      update: { value: String(active) },
      create: { key: "muni-emergency-mode", value: String(active) }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: active ? "EMERGENCY_MODE_ACTIVATED" : "EMERGENCY_MODE_DEACTIVATED",
        entity: "SystemSetting",
        entityId: "muni-emergency-mode",
        details: `Protocolo de emergencia climática ${active ? "ACTIVADO" : "DESACTIVADO"} por ${session.user.name || session.user.email}`
      }
    });

    revalidatePath("/", "layout");
    return { success: true, active };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al actualizar estado de emergencia" };
  }
}
