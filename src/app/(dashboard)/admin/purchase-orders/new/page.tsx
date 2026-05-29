export const dynamic = "force-dynamic";
import { getProviders } from "@/services/admin";
import { CreatePurchaseOrderForm } from "./create-order-form";

export default async function NewPurchaseOrderPage() {
  const providers = await getProviders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Orden de Compra</h1>
        <p className="text-slate-500 mt-2">
          Genere una nueva solicitud de compra para proveedores registrados.
        </p>
      </div>

      <CreatePurchaseOrderForm providers={providers} />
    </div>
  );
}
