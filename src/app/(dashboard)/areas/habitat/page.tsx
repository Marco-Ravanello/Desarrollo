export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export default async function HabitatAreaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { area, cases, stats } = await getAreaDashboardData([
    "Hábitat", "Habitat", "Vivienda", "Regularización"
  ]);

  return (
    <AreaDashboardView
      areaTitle="Hábitat, Vivienda y Barrio"
      areaDescription="Acompañamiento en regularización dominial, mejoras habitacionales, infraestructura socio-urbana y escrituración comunitaria."
      themeColor="blue"
      area={area}
      initialCases={cases as any}
      stats={stats}
    />
  );
}
