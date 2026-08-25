export const dynamic = "force-dynamic";

import { getEmergencyData } from "@/services/emergency";
import { EmergencyView } from "./emergency-view";

export default async function EmergencyOperationsPage() {
  const data = await getEmergencyData();
  return <EmergencyView initialData={data} />;
}
