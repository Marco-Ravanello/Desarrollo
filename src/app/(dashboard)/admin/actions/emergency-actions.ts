"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { searchPeopleForEmergency, getStormVictimRecords } from "@/services/emergency";
import { saveStormVictimRecord } from "@/services/emergency-save";
import { StormVictimItem } from "@/types/emergency";
import { actionErrorMessage } from "@/lib/action-error";
import { MANAGEMENT_ROLES, canEditSocialRecords, canManageEmergencyStock, isEmergencySurveyor } from "@/lib/permissions";

const STOCK_DENIED = "Tu usuario no puede modificar el stock de contingencia.";

export async function searchPeopleForEmergencyAction(query: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  return await searchPeopleForEmergency(query);
}

export async function saveStormVictimAction(recordData: Partial<StormVictimItem>) {
  const session = await auth();
  return await saveStormVictimRecord(session?.user, recordData);
}

export async function deleteStormVictimAction(recordId: string) {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  const cleanId = recordId.replace(/^case-/, "").replace(/^temp-/, "");

  if (isEmergencySurveyor(session.user.role)) {
    const owned = await prisma.stormVictimRecord.findUnique({ where: { id: recordId }, select: { createdById: true } }).catch(() => null);
    if (!owned || owned.createdById !== session.user.id) {
      return { success: false, error: "Solo podés eliminar las fichas que cargaste vos." };
    }
  }

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
    return { success: false, error: actionErrorMessage(err, "No se pudo eliminar el registro") };
  }
}

export async function updateEmergencyStockAction(
  supplyId: string,
  newStock: number,
  itemName?: string
) {
  const session = await auth();
  if (session?.user && !canManageEmergencyStock(session.user.role)) return { success: false, error: STOCK_DENIED };
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

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
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar stock") };
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
  if (session?.user && !canManageEmergencyStock(session.user.role)) return { success: false, error: STOCK_DENIED };
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

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
    return { success: false, error: actionErrorMessage(error, "No se pudo registrar el insumo") };
  }
}

export async function dispatchEmergencyStockAction(
  supplyId: string,
  quantity: number = 10,
  victimInfo?: string
) {
  const session = await auth();
  if (session?.user && !canManageEmergencyStock(session.user.role)) return { success: false, error: STOCK_DENIED };
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

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
    return { success: false, error: actionErrorMessage(error, "No se pudo despachar insumo") };
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
  if (session?.user && !MANAGEMENT_ROLES.includes(session.user.role)) {
    return { success: false, error: "No se pudo cambiar el modo emergencia: solo la conducción puede activarlo o desactivarlo." };
  }
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
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
    return { success: false, error: actionErrorMessage(err, "No se pudo actualizar estado de emergencia") };
  }
}
