export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPeopleForMap, getPeopleStats } from "@/services/people";
import { SocialMapDashboard } from "@/components/maps/social-map-dashboard";

export default async function MapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [people, stats] = await Promise.all([
    getPeopleForMap(10000),
    getPeopleStats()
  ]);

  return (
    <SocialMapDashboard
      initialPeople={people as any[]}
      stats={stats as any}
    />
  );
}
