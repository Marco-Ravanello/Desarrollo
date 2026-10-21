import { Car } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateVehicleForm } from "./create-vehicle-form";

export const metadata = { title: "Nuevo vehículo" };

export default function NewVehiclePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo vehículo"
        description="Completá los datos del vehículo para sumarlo a la flota."
        icon={Car}
      />

      <CreateVehicleForm />
    </div>
  );
}
