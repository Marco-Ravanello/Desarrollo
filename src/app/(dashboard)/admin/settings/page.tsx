export const dynamic = "force-dynamic";

import { getMunicipalSettings } from "@/services/municipal-settings";
import { MunicipalSettingsClient, type SystemStatus } from "./settings-client-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { INACTIVITY_LIMIT_MS } from "@/lib/inactivity";
import { isBlobStorageEnabled } from "@/lib/file-storage";

export const metadata = { title: "Configuración" };

/** Lo que de verdad está andando, en vez de carteles fijos. */
async function getSystemStatus(): Promise<SystemStatus> {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {}
  return {
    database,
    assistant: Boolean(process.env.GEMINI_API_KEY),
    fileStorage: isBlobStorageEnabled(),
    inactivityMinutes: Math.round(INACTIVITY_LIMIT_MS / 60000),
  };
}

export default async function MunicipalSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "SUPERADMIN" && role !== "ADMIN_GENERAL" && role !== "DIRECCION_GENERAL") {
    redirect("/dashboard");
  }

  const [settings, status] = await Promise.all([getMunicipalSettings(), getSystemStatus()]);
  return <MunicipalSettingsClient initialSettings={settings} status={status} canEdit={role !== "DIRECCION_GENERAL"} />;
}
