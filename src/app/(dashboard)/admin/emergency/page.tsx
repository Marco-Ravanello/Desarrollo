export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getEmergencyOperationsData } from "@/services/emergency";
import { EmergencyView } from "./emergency-view";

export default async function EmergencyOperationsPage() {
  const session = await auth();
  const data = await getEmergencyOperationsData(session?.user);

  return <EmergencyView initialData={data} />;
}
