export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FuelForm } from "./fuel-form";

export default async function FuelRecordPage() {
  const vehicles = await getVehicles();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Rendición de Combustible</h2>
        <p className="text-slate-500 text-sm">Registre los consumos de combustible de la flota municipal.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva Carga</CardTitle>
        </CardHeader>
        <CardContent>
          <FuelForm vehicles={vehicles} />
        </CardContent>
      </Card>
    </div>
  );
}
