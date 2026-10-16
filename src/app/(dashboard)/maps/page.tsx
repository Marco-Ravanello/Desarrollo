export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { getPeopleForMap, getPeopleStats } from "@/services/people";
import { SocialMapDashboard } from "@/components/maps/social-map-dashboard";

export default async function MapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [people, stats, unlocated] = await Promise.all([
    getPeopleForMap(10000),
    getPeopleStats(),
    // Personas del padrón que todavía no tienen un punto en el mapa
    prisma.padronUnificado.count({ where: { latitude: null } }).catch(() => 0),
  ]);

  return (
    <SocialMapDashboard
      initialPeople={people as any[]}
      stats={stats as any}
      unlocated={unlocated}
      canLocate={MANAGEMENT_ROLES.includes(session.user.role)}
    />
  );
}
