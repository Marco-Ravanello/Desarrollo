import { DashboardShell } from "./dashboard-shell";
import { auth } from "@/auth";
import { getMunicipalSettings } from "@/services/municipal-settings";
import { toPublicSettings } from "@/types/settings";

// Los datos de Configuración se leen de la base para que encabezados e impresiones sean iguales en todas las compus.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [rawSettings, session] = await Promise.all([getMunicipalSettings(), auth()]);
  const settings = toPublicSettings(rawSettings);
  return <DashboardShell settings={settings} session={session}>{children}</DashboardShell>;
}
