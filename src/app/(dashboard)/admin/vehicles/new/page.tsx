import { CreateVehicleForm } from "./create-vehicle-form";

export default function NewVehiclePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Nuevo Vehículo</h2>
        <p className="text-slate-500">Registre una nueva unidad a la flota municipal.</p>
      </div>

      <CreateVehicleForm />
    </div>
  );
}
