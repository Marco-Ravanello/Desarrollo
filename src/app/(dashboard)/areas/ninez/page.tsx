export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export const metadata = { title: "Niñez, Adolescencia y Familia" };

export default async function NinezAreaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { area, cases, stats } = await getAreaDashboardData([
    "Niñez", "Ninez", "Familia", "Adolescencia"
  ]);

  return (
    <AreaDashboardView
      areaTitle="Niñez, Adolescencia y Familia"
      areaDescription="Protección de los derechos de chicos, chicas y adolescentes, y apoyo a sus familias."
      themeColor="amber"
      area={area}
      initialCases={cases as any}
      stats={stats}
    />
  );
}
