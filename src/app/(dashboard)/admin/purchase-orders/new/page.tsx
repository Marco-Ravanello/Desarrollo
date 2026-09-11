export const dynamic = "force-dynamic";

import { getProviders } from "@/services/admin";
import { getAreas } from "@/services/cases";
import { CreatePurchaseOrderForm } from "./create-order-form";

export default async function NewPurchaseOrderPage() {
  const [providers, areas] = await Promise.all([
    getProviders(),
    getAreas()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Orden de Compra</h1>
        <p className="text-slate-500 mt-2">
          Genere una nueva solicitud de compra para proveedores registrados.
        </p>
      </div>

      <CreatePurchaseOrderForm providers={providers} areas={areas} />
    </div>
  );
}
