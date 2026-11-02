export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { FuelReportView } from "./report-view";
import { Fuel } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

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
      />

      <FuelReportView vehicles={vehicles} />
    </div>
  );
}
