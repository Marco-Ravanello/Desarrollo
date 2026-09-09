export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export default async function NinezAreaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { area, cases, stats } = await getAreaDashboardData([
    "Niñez", "Ninez", "Familia", "Adolescencia"
  ]);

  return (
    <AreaDashboardView
      areaTitle="Niñez, Adolescencia y Familia"
      areaDescription="Protección de derechos de niños, niñas y adolescentes, intervención de servicios locales y apoyo a familias en situación de vulnerabilidad."
      themeColor="amber"
      area={area}
      initialCases={cases as any}
      stats={stats}
    />
  );
}
