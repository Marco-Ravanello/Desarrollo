import { Car } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateVehicleForm } from "./create-vehicle-form";

export default function NewVehiclePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo Vehículo"
        description="Registre una nueva unidad a la flota municipal."
        icon={Car}
      />

      <CreateVehicleForm />
    </div>
  );
}
