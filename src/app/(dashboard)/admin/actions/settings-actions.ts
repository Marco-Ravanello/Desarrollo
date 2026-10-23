"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { MunicipalSettings, DEFAULT_MUNICIPAL_SETTINGS } from "@/types/settings";
import { SETTINGS_KEY, cleanSettings } from "@/services/municipal-settings";
import { actionErrorMessage } from "@/lib/action-error";

export async function saveSystemSettingsAction(settings: Partial<MunicipalSettings>) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  try {
    const merged = cleanSettings({ ...DEFAULT_MUNICIPAL_SETTINGS, ...settings });
    const value = JSON.stringify(merged);

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
          details: "Cambió los datos de Configuración."
        }
      });
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { success: true, settings: merged };
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar la configuración") };
  }
}

export async function resetSystemSettingsAction() {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

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
          details: "Volvió los datos de Configuración a los de fábrica."
        }
      });
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { success: true, settings: DEFAULT_MUNICIPAL_SETTINGS };
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo restablecer la configuración") };
  }
}
