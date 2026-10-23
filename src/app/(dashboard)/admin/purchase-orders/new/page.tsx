export const dynamic = "force-dynamic";

import { getProviderOptions } from "@/services/providers";
import { getAreas } from "@/services/cases";
import { CreatePurchaseOrderForm } from "./create-order-form";
import { PageHeader } from "@/components/layout/page-header";
import { Briefcase } from "lucide-react";

export const metadata = { title: "Nueva orden de compra" };

export default async function NewPurchaseOrderPage() {
  const [providers, areas] = await Promise.all([
    getProviderOptions(),
    getAreas()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva orden de compra"
        description="Elegí el proveedor y cargá lo que se va a comprar."
        icon={Briefcase}
      />

      <CreatePurchaseOrderForm providers={providers} areas={areas} />
    </div>
  );
}
