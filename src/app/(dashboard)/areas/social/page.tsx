export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export default async function SocialAreaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { area, cases, stats } = await getAreaDashboardData([
    "Protección Social", "Proteccion", "Social", "Desarrollo"
  ]);

  return (
    <AreaDashboardView
      areaTitle="Protección Social & Asistencia Directa"
      areaDescription="Gestión de ayudas urgentes, módulos alimentarios, contingencias climatológicas y subsidios a familias vulnerables."
      themeColor="emerald"
      area={area}
      initialCases={cases as any}
      stats={stats}
    />
  );
}
