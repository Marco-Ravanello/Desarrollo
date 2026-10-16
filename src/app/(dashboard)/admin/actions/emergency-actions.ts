"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  searchPeopleForEmergency,
  getStormVictimRecords,
  EMERGENCY_CATEGORIES,
  EmergencyCategoryKey,
  findCategorySupply,
} from "@/services/emergency";
import { cleanItemQuantities, extraQuantityText, quantityText } from "@/lib/emergency-categories";
import { DELIVERY_DB_PENDING_MESSAGE, isDeliveryTableReady, stormRecordOmit } from "@/services/emergency-db-status";
import { saveStormVictimRecord } from "@/services/emergency-save";
import { getCategoryLinks, getEmergencyExtraItems, linkCategorySupply, saveEmergencyExtraItems } from "@/services/emergency-stock-links";
import { EmergencyStockItem, StormVictimItem } from "@/types/emergency";
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

        const created = await prisma.supplyItem.create({
          data: {
            id: supplyId.startsWith("stock-cat-") ? undefined : supplyId,
            name: nameToUse,
            description: "Stock de contingencia configurado manualmente",
            stock: validStock,
            minStock: 10,
          },
        });
        if (["COLCHON", "CAMA", "CUCHETA", "FRAZADA"].includes(catKey)) {
          await linkCategorySupply(catKey as EmergencyCategoryKey, created.id);
        }
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

/**
 * Cambia el nombre y el stock de un insumo de emergencia. Los insumos de las
 * fichas (colchones, camas...) quedan vinculados por id, así que se pueden
 * renombrar sin perder la relación con lo que piden las fichas.
 */
export async function editEmergencyStockItemAction(data: {
  id: string;
  category: EmergencyStockItem["category"];
  name: string;
  stock: number;
}) {
  const session = await auth();
  if (session?.user && !canManageEmergencyStock(session.user.role)) return { success: false, error: STOCK_DENIED };
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };

  const name = (data.name || "").trim().slice(0, 120);
  if (!name) return { success: false, error: "El nombre del insumo es obligatorio" };
  const stock = Math.max(0, Math.floor(Number(data.stock) || 0));
  const cat = EMERGENCY_CATEGORIES.find((c) => c.key === data.category);

  try {
    const existing = await prisma.supplyItem.findUnique({ where: { id: data.id } });
    let item;
    if (existing) {
      item = await prisma.supplyItem.update({ where: { id: existing.id }, data: { name, stock } });
    } else if (cat && data.id.startsWith("stock-cat-")) {
      // Todavía no había insumo cargado para este elemento de las fichas.
      item = await prisma.supplyItem.create({
        data: { name, description: "Stock de contingencia", stock, minStock: cat.minStock },
      });
    } else {
      const extras = await getEmergencyExtraItems();
      const extra = extras.find((ci) => ci?.id === data.id);
      if (!extra) return { success: false, error: "No se encontró el insumo. Actualizá la página y probá de nuevo." };
      item = await prisma.supplyItem.create({
        data: { id: extra.id, name, description: extra.description || "Insumo de contingencia climática", stock, minStock: Number(extra.minStock) || 5 },
      });
    }

    if (cat) await linkCategorySupply(cat.key, item.id);

    const extras = await getEmergencyExtraItems();
    if (extras.some((ci) => ci?.id === item.id)) {
      await saveEmergencyExtraItems(extras.map((ci) => (ci?.id === item.id ? { ...ci, name, availableStock: stock } : ci)));
    }

    const changes = [
      existing && existing.name !== name ? `nombre "${existing.name}" → "${name}"` : null,
      !existing || existing.stock !== stock ? `stock ${existing ? `${existing.stock} → ` : ""}${stock}` : null,
    ].filter(Boolean);
    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "EMERGENCY_STOCK_UPDATE",
          entity: "SupplyItem",
          entityId: item.id,
          details: `Insumo de emergencia ${name}: ${changes.join(", ") || "sin cambios"} (${session.user.name || session.user.email})`,
        },
      })
      .catch((err) => console.warn("AuditLog skipped:", err));

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/stock");
    return { success: true, name: item.name, stock: item.stock };
  } catch (error: any) {
    console.error("Error editing emergency stock item:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar el insumo") };
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
      // Sin insumo cargado no hay de dónde despachar (no se inventa stock).
      return { success: false, error: "Ese insumo no tiene stock cargado. Cargá primero la cantidad disponible." };
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

/** Error con un mensaje pensado para mostrar tal cual. */
class DeliveryError extends Error {}

export type DeliveryQuantities = Partial<Record<EmergencyCategoryKey, number>>;

/**
 * Registra una entrega de elementos de una ficha de tormenta: descuenta del
 * stock del depósito, deja constancia en la ficha y en su expediente. Puede
 * ser parcial (lo que falta queda pendiente).
 */
export async function deliverStormItemsAction(
  recordId: string,
  quantities: DeliveryQuantities,
  observaciones?: string,
  /** Otros insumos entregados (chapas, nylon...): { idInsumo: cantidad }. */
  otros?: Record<string, number>
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  if (!canManageEmergencyStock(session.user.role)) return { success: false, error: "Tu usuario no puede registrar entregas." };
  if (!(await isDeliveryTableReady())) return { success: false, error: DELIVERY_DB_PENDING_MESSAGE };

  const qty = Object.fromEntries(
    EMERGENCY_CATEGORIES.map((c) => [c.key, Math.max(0, Math.floor(Number(quantities?.[c.key]) || 0))])
  ) as Record<EmergencyCategoryKey, number>;
  const otrosQty = cleanItemQuantities(otros);
  if (Object.values(qty).every((q) => q === 0) && Object.keys(otrosQty).length === 0) {
    return { success: false, error: "Indicá al menos un elemento entregado." };
  }

  const userId = session.user.id;
  const userName = session.user.name || session.user.email || "Usuario";

  try {
    const omit = await stormRecordOmit();
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.stormVictimRecord.findUnique({ where: { id: recordId }, include: { entregas: true }, omit });
      if (!record) throw new DeliveryError("Esta ficha es de un respaldo anterior y no admite entregas.");

      const delivered = {
        COLCHON: record.entregas.reduce((a, e) => a + e.colchones, 0),
        CAMA: record.entregas.reduce((a, e) => a + e.camas, 0),
        CUCHETA: record.entregas.reduce((a, e) => a + e.cuchetas, 0),
        FRAZADA: record.entregas.reduce((a, e) => a + e.frazadas, 0),
      };
      const requested = {
        COLCHON: record.cantidadColchon,
        CAMA: record.cantidadCama,
        CUCHETA: record.cantidadCucheta,
        FRAZADA: record.cantidadFrazada,
      };

      const supplies = await tx.supplyItem.findMany();
      const links = await getCategoryLinks(tx);
      let overrides: Record<string, number> = {};
      try {
        const setting = await tx.systemSetting.findUnique({ where: { key: "muni-emergency-stock-overrides" } });
        if (setting?.value) overrides = JSON.parse(setting.value);
      } catch {}

      for (const cat of EMERGENCY_CATEGORIES) {
        const q = qty[cat.key];
        if (q === 0) continue;
        const pending = Math.max(0, requested[cat.key] - delivered[cat.key]);
        if (q > pending) {
          throw new DeliveryError(
            pending === 0
              ? `En esta ficha no quedan ${cat.label} por entregar`
              : `En esta ficha quedan ${pending} ${cat.label} por entregar, no ${q}`
          );
        }

        let item = findCategorySupply(supplies, cat.key, links);
        if (!item && overrides[cat.key] !== undefined) {
          // El stock se había cargado a mano antes de existir el insumo: se crea con esa cantidad.
          item = await tx.supplyItem.create({
            data: { name: cat.defaultName, description: "Stock de contingencia", stock: Number(overrides[cat.key]) || 0, minStock: cat.minStock },
          });
          supplies.push(item);
          await linkCategorySupply(cat.key, item.id, tx);
          links[cat.key] = item.id;
        }
        if (!item) throw new DeliveryError(`No hay stock de ${cat.label} cargado en el depósito de contingencia`);

        const updated = await tx.supplyItem.updateMany({
          where: { id: item.id, stock: { gte: q } },
          data: { stock: { decrement: q } },
        });
        if (updated.count === 0) {
          const fresh = await tx.supplyItem.findUnique({ where: { id: item.id } });
          throw new DeliveryError(`No alcanza el stock de ${cat.label}: quedan ${fresh?.stock ?? 0}`);
        }
        await tx.supplyRequest.create({ data: { supplyId: item.id, quantity: q, userId, status: "ENTREGADO" } });
      }

      // Otros insumos pedidos en la ficha.
      const requestedOtros = cleanItemQuantities(record.otrosElementos);
      const deliveredOtros: Record<string, number> = {};
      for (const e of record.entregas) {
        for (const [id, n] of Object.entries(cleanItemQuantities(e.otrosElementos))) deliveredOtros[id] = (deliveredOtros[id] || 0) + n;
      }
      const otrosNames = new Map<string, string>();
      for (const [id, q] of Object.entries(otrosQty)) {
        const item = supplies.find((s) => s.id === id);
        if (!item) throw new DeliveryError("Uno de los insumos ya no existe en el depósito");
        otrosNames.set(id, item.name);
        const pending = Math.max(0, (requestedOtros[id] || 0) - (deliveredOtros[id] || 0));
        if (q > pending) {
          throw new DeliveryError(
            pending === 0
              ? `En esta ficha no quedan ${item.name} por entregar`
              : `En esta ficha quedan ${pending} ${item.name} por entregar, no ${q}`
          );
        }
        const updated = await tx.supplyItem.updateMany({
          where: { id, stock: { gte: q } },
          data: { stock: { decrement: q } },
        });
        if (updated.count === 0) {
          const fresh = await tx.supplyItem.findUnique({ where: { id } });
          throw new DeliveryError(`No alcanza el stock de ${item.name}: quedan ${fresh?.stock ?? 0}`);
        }
        await tx.supplyRequest.create({ data: { supplyId: id, quantity: q, userId, status: "ENTREGADO" } });
      }

      await tx.stormDelivery.create({
        data: {
          recordId,
          colchones: qty.COLCHON,
          camas: qty.CAMA,
          cuchetas: qty.CUCHETA,
          frazadas: qty.FRAZADA,
          ...(Object.keys(otrosQty).length > 0 ? { otrosElementos: otrosQty } : {}),
          observaciones: observaciones?.trim() || null,
          userId,
          userName,
        },
      });

      const complete =
        EMERGENCY_CATEGORIES.every((c) => requested[c.key] - delivered[c.key] - qty[c.key] <= 0) &&
        Object.entries(requestedOtros).every(([id, n]) => n - (deliveredOtros[id] || 0) - (otrosQty[id] || 0) <= 0);
      const estado = complete ? "ENTREGADO" : "ENTREGA_PARCIAL";
      await tx.stormVictimRecord.update({ where: { id: recordId }, data: { estado }, omit });

      return { estado, caseId: record.caseId, personId: record.personId, nombre: record.nombreApellido, otrosNames };
    });

    const summary = [
      ...EMERGENCY_CATEGORIES.filter((c) => qty[c.key] > 0).map((c) => quantityText(c.key, qty[c.key])),
      ...Object.entries(otrosQty).map(([id, n]) => extraQuantityText(id, n, result.otrosNames)),
    ].join(", ");

    if (result.caseId && result.personId) {
      await prisma.intervention
        .create({
          data: {
            caseId: result.caseId,
            personId: result.personId!,
            userId,
            description: `Entrega de elementos de emergencia: ${summary}.${observaciones?.trim() ? ` ${observaciones.trim()}` : ""}`,
          },
        })
        .catch((e) => console.warn("No se pudo registrar la entrega en el expediente:", e));
    }
    await prisma.auditLog
      .create({
        data: {
          userId,
          action: "STORM_DELIVERY",
          entity: "StormVictimRecord",
          entityId: recordId,
          details: `Entrega a ${result.nombre}: ${summary}. Registrada por ${userName}.`,
        },
      })
      .catch((e) => console.warn("AuditLog skipped:", e));

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/stock");
    revalidatePath("/cases");
    return { success: true, estado: result.estado, summary };
  } catch (err) {
    if (err instanceof DeliveryError) {
      return { success: false, error: `No se pudo registrar la entrega: ${err.message.charAt(0).toLowerCase()}${err.message.slice(1)}.` };
    }
    console.error("Error registrando entrega de emergencia:", err);
    return { success: false, error: actionErrorMessage(err, "No se pudo registrar la entrega") };
  }
}
