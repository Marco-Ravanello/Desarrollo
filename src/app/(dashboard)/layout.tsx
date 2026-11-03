import { DashboardShell } from "./dashboard-shell";
import { auth } from "@/auth";
import { getMunicipalSettings } from "@/services/municipal-settings";
import { toPublicSettings } from "@/types/settings";
import prisma from "@/lib/prisma";

// Los datos de Configuración se leen de la base para que encabezados e impresiones sean iguales en todas las compus.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [rawSettings, session] = await Promise.all([getMunicipalSettings(), auth()]);
  const settings = toPublicSettings(rawSettings);
  // La bienvenida se muestra una sola vez por persona (no por navegador).
  const userId = session?.user?.id;
  const showWelcome = userId
    ? await prisma.user
        .findUnique({ where: { id: userId }, select: { welcomeSeenAt: true } })
        .then((u) => Boolean(u && !u.welcomeSeenAt))
        .catch(() => false)
    : false;
  return <DashboardShell settings={settings} session={session} showWelcome={showWelcome}>{children}</DashboardShell>;
}
