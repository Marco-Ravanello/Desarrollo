export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { ReserveVehicleForm } from "./reserve-form";

export default async function ReserveVehiclePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const vehicles = await getVehicles();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reservar Vehículo</h2>
        <p className="text-slate-500 text-sm">Seleccione la unidad y el período de tiempo.</p>
      </div>

      <ReserveVehicleForm vehicleId={id || ""} vehicles={vehicles} />
    </div>
  );
}
