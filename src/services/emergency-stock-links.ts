import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { CategoryLinks, EmergencyCategoryKey } from "@/lib/emergency-categories";

// Qué insumo del depósito corresponde a cada elemento de las fichas, para que
// renombrarlo no lo desvincule. Y qué insumos se agregaron desde Emergencia.

const LINKS_KEY = "muni-emergency-category-items";
export const EMERGENCY_EXTRA_ITEMS_KEY = "custom-emergency-stock-items";

type Db = typeof prisma | Prisma.TransactionClient;

export async function getCategoryLinks(db: Db = prisma): Promise<CategoryLinks> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: LINKS_KEY } });
    const parsed = setting?.value ? JSON.parse(setting.value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("No se pudieron leer los insumos vinculados a las fichas:", err);
    return {};
  }
}

export async function linkCategorySupply(key: EmergencyCategoryKey, supplyId: string, db: Db = prisma) {
  const links = await getCategoryLinks(db);
  if (links[key] === supplyId) return;
  links[key] = supplyId;
  const value = JSON.stringify(links);
  await db.systemSetting.upsert({ where: { key: LINKS_KEY }, update: { value }, create: { key: LINKS_KEY, value } });
}

/** Insumos agregados desde la pantalla de Emergencia (con nombre, unidad, etc.). */
export async function getEmergencyExtraItems(db: Db = prisma): Promise<any[]> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: EMERGENCY_EXTRA_ITEMS_KEY } });
    const parsed = setting?.value ? JSON.parse(setting.value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("No se pudieron leer los insumos agregados desde Emergencia:", err);
    return [];
  }
}

export async function saveEmergencyExtraItems(items: any[], db: Db = prisma) {
  const value = JSON.stringify(items);
  await db.systemSetting.upsert({
    where: { key: EMERGENCY_EXTRA_ITEMS_KEY },
    update: { value },
    create: { key: EMERGENCY_EXTRA_ITEMS_KEY, value },
  });
}
