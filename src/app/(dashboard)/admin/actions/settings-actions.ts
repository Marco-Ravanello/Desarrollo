"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const SETTINGS_KEY = "muni-system-settings";

export interface MunicipalSettings {
  municipalityName: string;
  provinceName: string;
  secretariatName: string;
  directionName: string;
  mayorName: string;
  secretaryName: string;
  mainPhone: string;
  emergencyPhone: string;
  officialEmail: string;
  officialWebsite: string;
  headquartersAddress: string;
  customLogoUrl: string;
  sessionTimeout: string;
  aiAnonymization: boolean;
  maintenanceMode: boolean;
}

export const DEFAULT_MUNICIPAL_SETTINGS: MunicipalSettings = {
  municipalityName: "Municipalidad de Tres de Febrero",
  provinceName: "Provincia de Buenos Aires • República Argentina",
  secretariatName: "Secretaría de Desarrollo Humano y Hábitat",
  directionName: "Dirección General de Gestión Social y Hábitat",
  mayorName: "Lic. Diego Valenzuela (Intendente Municipal)",
  secretaryName: "Lic. Bautista Pino (Secretario General)",
  mainPhone: "0800-888-0333 / Línea 147 (Atención al Vecino)",
  emergencyPhone: "Línea 103 (Defensa Civil) • 107 (SAME) • 911",
  officialEmail: "desarrollohumano@tresdefebrero.gov.ar",
  officialWebsite: "https://www.tresdefebrero.gov.ar",
  headquartersAddress: "Juan Bautista Alberdi 4840, Caseros, Tres de Febrero (B1678)",
  customLogoUrl: "",
  sessionTimeout: "8",
  aiAnonymization: true,
  maintenanceMode: false
};

export async function getSystemSettingsAction() {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: SETTINGS_KEY }
    });

    if (record?.value) {
      const parsed = JSON.parse(record.value);
      return { success: true, settings: { ...DEFAULT_MUNICIPAL_SETTINGS, ...parsed } };
    }
    return { success: true, settings: DEFAULT_MUNICIPAL_SETTINGS };
  } catch (error: any) {
    return {
      success: false,
      settings: DEFAULT_MUNICIPAL_SETTINGS,
      error: error.message || "Error al recuperar la configuración"
    };
  }
}

export async function saveSystemSettingsAction(settings: Partial<MunicipalSettings>) {
  const session = await auth();

  try {
    const merged = { ...DEFAULT_MUNICIPAL_SETTINGS, ...settings };
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
          details: `Configuración de identidad institucional de Tres de Febrero actualizada por ${session.user.name || session.user.email}`
        }
      });
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { success: true, settings: merged };
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
          details: "Restablecimiento de configuración institucional a valores oficiales de Tres de Febrero"
        }
      });
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { success: true, settings: DEFAULT_MUNICIPAL_SETTINGS };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al restablecer la configuración" };
  }
}
