export const dynamic = "force-dynamic";

import { getProviders } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { CreatePurchaseOrderForm } from "./create-order-form";
import { PageHeader } from "@/components/layout/page-header";
import { Briefcase } from "lucide-react";

export default async function NewPurchaseOrderPage() {
  const [providers, areas] = await Promise.all([
    getProviders(),
    getAreas()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva Orden de Compra"
        description="Genere una nueva solicitud de compra para proveedores registrados."
        icon={Briefcase}
      />

      <CreatePurchaseOrderForm providers={providers} areas={areas} />
    </div>
  );
}
