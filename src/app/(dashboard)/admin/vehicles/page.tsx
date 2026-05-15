export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { Card } from "@/components/ui/card";
import { Truck } from "lucide-react";

export default async function VehiclesPage() {
  const vehicles = await getVehicles();
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Flota de Vehículos</h2>
      <div className="grid gap-4 md:grid-cols-4">
        {vehicles.map(v => (
          <Card key={v.id} className="p-4 flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Truck className="h-6 w-6"/></div>
            <div>
              <p className="font-bold font-mono">{v.plate}</p>
              <p className="text-sm text-slate-500">{v.brand} {v.model}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
