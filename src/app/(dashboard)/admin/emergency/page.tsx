export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getEmergencyOperationsData } from "@/services/emergency";
import { EmergencyView } from "./emergency-view";

export const metadata = { title: "Emergencia climática" };

export default async function EmergencyOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ "sin-permiso"?: string }>;
}) {
  const session = await auth();
  const data = await getEmergencyOperationsData(session?.user);
  const deniedAccess = (await searchParams)["sin-permiso"] === "1";

  return <EmergencyView initialData={data} deniedAccess={deniedAccess} />;
}
