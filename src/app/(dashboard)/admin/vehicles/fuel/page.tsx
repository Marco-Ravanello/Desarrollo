export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FuelForm } from "./fuel-form";
import { Fuel } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Cargar combustible" };

export default async function FuelRecordPage() {
  const vehicles = await getVehicles();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Cargar combustible"
        description="Anotá cada carga de combustible de los vehículos."
        icon={Fuel}
      />

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
