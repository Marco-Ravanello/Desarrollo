export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { FuelReportView } from "./report-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Fuel } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";

export default async function ReportsPage() {
  const vehicles = await getVehicles();

  return (
    <div className="space-y-6">
      <PageHeader
        className="print:hidden"
        title="Reportes de Combustible"
        description="Resumen mensual de gastos por vehículo."
        icon={Fuel}
        actions={
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/vehicles"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />

      <FuelReportView vehicles={vehicles} />
    </div>
  );
}
