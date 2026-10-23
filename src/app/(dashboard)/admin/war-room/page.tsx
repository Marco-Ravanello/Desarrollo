export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getWarRoomData } from "@/services/war-room";
import { WarRoomView } from "./war-room-view";

export const metadata = { title: "Sala de Situación" };

export default async function ExecutiveWarRoomPage() {
  const session = await auth();
  const role = session?.user?.role;
  const data = await getWarRoomData({ canViewSensitive: Boolean(role && hasPermission(role, PERMISSIONS.VIEW_SENSITIVE_CASES)) });
  return <WarRoomView initialData={data} />;
}
