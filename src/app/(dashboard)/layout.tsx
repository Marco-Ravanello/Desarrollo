import { DashboardShell } from "./dashboard-shell";
import { getMunicipalSettings } from "@/services/municipal-settings";
import { toPublicSettings } from "@/types/settings";

// Los datos de Configuración se leen de la base para que encabezados e impresiones sean iguales en todas las compus.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const settings = toPublicSettings(await getMunicipalSettings());
  return <DashboardShell settings={settings}>{children}</DashboardShell>;
}
