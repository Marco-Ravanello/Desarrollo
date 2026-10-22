export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { FuelReportView } from "./report-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Fuel } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";

export const metadata = { title: "Gasto en combustible" };

export default async function ReportsPage() {
  const vehicles = await getVehicles();

  return (
    <div className="space-y-6">
      <PageHeader
        className="print:hidden"
        title="Gasto en combustible"
        description="Cuánto se gastó en cada vehículo, mes por mes."
        icon={Fuel}
        actions={
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/vehicles" aria-label="Volver a vehículos"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />

      <FuelReportView vehicles={vehicles} />
    </div>
  );
}
