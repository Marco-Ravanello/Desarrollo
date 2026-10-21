export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAreaDashboardData } from "@/services/cases";
import { AreaDashboardView } from "@/components/areas/area-dashboard-view";

export const metadata = { title: "Violencia de Género" };

export default async function ViolenceAreaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userRole = session.user.role;
  const isAllowed =
    userRole === "SUPERADMIN" ||
    userRole === "DIRECCION_GENERAL" ||
    userRole === "VIOLENCIA_GENERO";

  if (!isAllowed) {
    redirect("/dashboard");
  }

  const { area, cases, stats } = await getAreaDashboardData([
    "Violencia", "Mujeres", "Género", "Genero"
  ]);

  return (
    <AreaDashboardView
      areaTitle="Violencia de Género"
      areaDescription="Acompañamiento, medidas de protección, alojamiento y asistencia psicológica a quienes sufren violencia."
      themeColor="rose"
      area={area}
      initialCases={cases as any}
      stats={stats}
      isSensitive={true}
    />
  );
}
