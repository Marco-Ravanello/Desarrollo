export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { MANAGEMENT_ROLES, PERMISSIONS, hasPermission } from "@/lib/permissions";
import { getMapData, getMapPrograms } from "@/services/map";
import { SocialMapDashboard } from "@/components/maps/social-map-dashboard";

export const metadata = { title: "Mapa Social" };

export default async function MapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [data, programs, unlocated] = await Promise.all([
    getMapData({}),
    getMapPrograms().catch(() => []),
    // Personas del padrón que todavía no tienen un punto en el mapa
    prisma.padronUnificado.count({ where: { latitude: null } }).catch(() => 0),
  ]);

  return (
    <SocialMapDashboard
      initialData={data}
      programs={programs}
      unlocated={unlocated}
      canLocate={MANAGEMENT_ROLES.includes(session.user.role)}
      canExport={hasPermission(session.user.role, PERMISSIONS.EXPORT_PERSONAL_DATA)}
    />
  );
}
