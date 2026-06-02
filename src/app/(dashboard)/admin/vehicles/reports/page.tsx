export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { FuelReportView } from "./report-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ReportsPage() {
  const vehicles = await getVehicles();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/vehicles"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reportes de Combustible</h2>
          <p className="text-slate-500 text-sm">Resumen mensual de gastos por vehículo.</p>
        </div>
      </div>

      <FuelReportView vehicles={vehicles} />
    </div>
  );
}
