"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const SETTINGS_KEY = "muni-system-settings";

export async function getSystemSettingsAction() {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: SETTINGS_KEY }
    });

    if (record?.value) {
      return { success: true, settings: JSON.parse(record.value) };
    }
    return { success: true, settings: null };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al recuperar la configuración" };
  }
}

export async function saveSystemSettingsAction(settings: any) {
  const session = await auth();

  try {
    const value = JSON.stringify(settings);

    await prisma.systemSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value },
      create: { key: SETTINGS_KEY, value }
    });

    if (session?.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE_SYSTEM_SETTINGS",
          entity: "SystemSetting",
          entityId: SETTINGS_KEY,
          details: `Configuración de identidad institucional actualizada por ${session.user.name || session.user.email}`
        }
      });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al guardar la configuración" };
  }
}

export async function resetSystemSettingsAction() {
  const session = await auth();

  try {
    await prisma.systemSetting.deleteMany({
      where: { key: SETTINGS_KEY }
    });

    if (session?.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RESET_SYSTEM_SETTINGS",
          entity: "SystemSetting",
          entityId: SETTINGS_KEY,
          details: "Restablecimiento de configuración institucional a valores por defecto"
        }
      });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al restablecer la configuración" };
  }
}
