export const dynamic = "force-dynamic";

import { getWarRoomData } from "@/services/war-room";
import { WarRoomView } from "./war-room-view";

export default async function ExecutiveWarRoomPage() {
  const data = await getWarRoomData();
  return <WarRoomView initialData={data} />;
}
