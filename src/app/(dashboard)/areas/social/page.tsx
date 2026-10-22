export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export const metadata = { title: "Protección Social" };

export default async function SocialAreaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { area, cases, stats } = await getAreaDashboardData([
    "Protección Social", "Proteccion Social", "Social"
  ]);

  return (
    <AreaDashboardView
      areaTitle="Protección Social"
      areaDescription="Ayudas urgentes, módulos alimentarios, emergencias climáticas y subsidios a familias."
      themeColor="emerald"
      area={area}
      initialCases={cases as any}
      stats={stats}
    />
  );
}
