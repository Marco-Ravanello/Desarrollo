export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export const metadata = { title: "Hábitat y Vivienda" };

export default async function HabitatAreaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { area, cases, stats } = await getAreaDashboardData([
    "Hábitat", "Habitat", "Vivienda", "Regularización"
  ]);

  return (
    <AreaDashboardView
      areaTitle="Hábitat y Vivienda"
      areaDescription="Regularización de terrenos, escrituras, mejoras de vivienda y obras en los barrios."
      themeColor="blue"
      area={area}
      initialCases={cases as any}
      stats={stats}
    />
  );
}
