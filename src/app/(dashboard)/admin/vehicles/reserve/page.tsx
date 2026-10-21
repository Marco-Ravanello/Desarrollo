export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { ReserveVehicleForm } from "./reserve-form";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Reservar vehículo" };

export default async function ReserveVehiclePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const vehicles = await getVehicles();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservar vehículo"
        description="Elegí el vehículo y desde cuándo hasta cuándo lo necesitás."
        icon={Calendar}
      />

      <ReserveVehicleForm vehicleId={id || ""} vehicles={vehicles} />
    </div>
  );
}
