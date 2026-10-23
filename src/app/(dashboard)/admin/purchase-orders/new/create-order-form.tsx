"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createPurchaseOrderAction } from "../../actions/create-purchase-order";
import { Plus, Trash2, Info } from "lucide-react";
import { EmptyMessage } from "@/components/ui/empty-message";
import dynamic from "next/dynamic";
import type { ProviderOption } from "@/services/providers";
import { ProviderPicker } from "./provider-picker";

const OCRScanner = dynamic(() => import("@/components/ocr/ocr-scanner").then(mod => mod.OCRScanner), {
  ssr: false,
});

export function CreatePurchaseOrderForm({ providers, areas = [] }: { providers: ProviderOption[]; areas?: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState({
    number: "",
    areaId: "",
    amount: "",
    providerId: "",
    providerName: "",
    providerCuit: "",
    providerNumber: "",
    expediente: "",
    deliveryDate: "",
    deliveryPlace: "",
    paymentTerms: "",
    description: ""
  });

  const [items, setItems] = useState<any[]>([]);

  const handleScanComplete = (data: any) => {
    // Si el CUIT leído es de un proveedor dado de alta, se usa ese.
    const scannedCuit = String(data.cuit || "").replace(/[^0-9]/g, "");
    const matched = scannedCuit ? providers.find((p) => p.cuit.replace(/[^0-9]/g, "") === scannedCuit) : undefined;

    setOrderData(prev => ({
      ...prev,
      number: data.number || prev.number,
      amount: data.amount || prev.amount,
      providerId: matched?.id || (data.providerName || data.cuit ? "" : prev.providerId),
      providerName: matched?.name || data.providerName || prev.providerName,
      providerCuit: matched?.cuit || data.cuit || prev.providerCuit,
      providerNumber: data.providerNumber || prev.providerNumber,
      expediente: data.expediente || prev.expediente,
      deliveryDate: data.deliveryDate ? data.deliveryDate.split('/').reverse().join('-') : prev.deliveryDate,
      deliveryPlace: data.deliveryPlace || prev.deliveryPlace,
      paymentTerms: data.paymentTerms || prev.paymentTerms,
      description: data.description || prev.description
    }));

    if (data.items && data.items.length > 0) {
      setItems(data.items);
    }

    if (data.number || data.amount || data.cuit || data.providerName || data.providerNumber || data.expediente || data.description || (data.items && data.items.length > 0)) {
        toast.success("Datos extraídos correctamente");
    } else {
        toast.warning("No se detectaron campos conocidos en el documento");
    }
  };

  const addItem = () => {
    setItems([...items, { quantity: "1", unitOfMeasure: "UNIDAD", description: "", unitPrice: "0", totalPrice: "0" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Auto-calculate total price if quantity or unit price changes
    if (field === "quantity" || field === "unitPrice") {
      const q = parseFloat(newItems[index].quantity) || 0;
      const p = parseFloat(newItems[index].unitPrice) || 0;
      newItems[index].totalPrice = (q * p).toFixed(2);
    }

    setItems(newItems);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!orderData.providerId && !orderData.providerName.trim()) {
      toast.error("Elegí el proveedor de la lista o escribilo a mano.");
      document.getElementById("providerSearch")?.focus();
      return;
    }

    // Validation
    const itemsTotal = items.reduce((acc, item) => acc + (parseFloat(item.totalPrice) || 0), 0);
    const orderTotal = parseFloat(orderData.amount) || 0;

    if (items.length > 0 && Math.abs(itemsTotal - orderTotal) > 0.01) {
      toast.error(`El total de los ítems ($${itemsTotal.toLocaleString("es-AR")}) no coincide con el total de la orden ($${orderTotal.toLocaleString("es-AR")})`);
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("areaId", orderData.areaId);
    formData.append("items", JSON.stringify(items));

    try {
      const result = await createPurchaseOrderAction(formData);
      if (result.success) {
        toast.success("Orden de compra registrada");
        router.push("/admin/purchase-orders");
      } else {
        toast.error(result.error || "Error al registrar orden");
      }
    } catch (error) {
      toast.error("No se pudo guardar la orden. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-white/75 dark:bg-card/75 backdrop-blur-md border border-border/40 shadow-municipal">
      <CardHeader>
        <CardTitle>Nueva orden</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
           <h4 className="text-xs font-bold text-muted-foreground mb-3">Asistente de carga rápida</h4>
           <OCRScanner onScanComplete={handleScanComplete} label="Escanear la orden" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">Número de orden</Label>
              <Input
                id="number"
                name="number"
                placeholder="Ej: OC-2026-001"
                required
                value={orderData.number}
                onChange={(e) => setOrderData({...orderData, number: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaId">Secretaría / área solicitante</Label>
              <select
                id="areaId"
                name="areaId"
                value={orderData.areaId}
                onChange={(e) => setOrderData({ ...orderData, areaId: e.target.value })}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Elegí un área</option>
                {areas.map((area: any) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <ProviderPicker
                providers={providers}
                value={{ providerId: orderData.providerId, providerName: orderData.providerName, providerCuit: orderData.providerCuit }}
                onChange={(p) => setOrderData((prev) => ({ ...prev, ...p }))}
                onPick={(p) => setOrderData((prev) => ({ ...prev, providerNumber: p.lastNumber || prev.providerNumber }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="providerNumber">N° de proveedor</Label>
              <Input
                id="providerNumber"
                name="providerNumber"
                placeholder="Ej: 20264"
                value={orderData.providerNumber}
                onChange={(e) => setOrderData({...orderData, providerNumber: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Importe total ($)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
                value={orderData.amount}
                onChange={(e) => setOrderData({...orderData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expediente">N° expediente</Label>
              <Input
                id="expediente"
                name="expediente"
                placeholder="Ej: 312/2026"
                value={orderData.expediente}
                onChange={(e) => setOrderData({...orderData, expediente: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Fecha estimada de entrega</Label>
              <Input
                id="deliveryDate"
                name="deliveryDate"
                type="date"
                value={orderData.deliveryDate}
                onChange={(e) => setOrderData({...orderData, deliveryDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryPlace">Lugar de entrega</Label>
              <Input
                id="deliveryPlace"
                name="deliveryPlace"
                placeholder="Ej: Palacio Municipal"
                value={orderData.deliveryPlace}
                onChange={(e) => setOrderData({...orderData, deliveryPlace: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Condición de pago</Label>
              <Input
                id="paymentTerms"
                name="paymentTerms"
                placeholder="Ej: 1 Mes"
                value={orderData.paymentTerms}
                onChange={(e) => setOrderData({...orderData, paymentTerms: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Descripción / motivo</Label>
              <textarea
                id="description"
                name="description"
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Detalle general de la compra..."
                value={orderData.description}
                onChange={(e) => setOrderData({...orderData, description: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Ítems de la orden</h3>
                  <div className="bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">
                    {items.length} {items.length === 1 ? 'renglón' : 'renglones'}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="text-blue-600 border-blue-500/30">
                  <Plus className="h-4 w-4 mr-1" /> Agregar ítem
                </Button>
             </div>

             {items.length === 0 ? (
               <EmptyMessage
                 icon={Info}
                 compact
                 title="Todavía no hay ítems en la orden"
                 description="Agregá uno a mano o subí la factura para leerla automáticamente."
                 className="rounded-xl border-2 border-dashed border-border/60"
               />
             ) : (
               <div className="border rounded-xl overflow-hidden">
                 <table className="w-full text-sm">
                   <thead className="bg-muted/50 border-b">
                     <tr>
                       <th className="text-left p-3 font-medium text-muted-foreground">Cant.</th>
                       <th className="text-left p-3 font-medium text-muted-foreground">Unidad</th>
                       <th className="text-left p-3 font-medium text-muted-foreground w-full">Descripción</th>
                       <th className="text-left p-3 font-medium text-muted-foreground text-right">Unitario</th>
                       <th className="text-left p-3 font-medium text-muted-foreground text-right">Total</th>
                       <th className="p-3"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {items.map((item, index) => (
                       <tr key={index} className="hover:bg-muted/30 transition-colors">
                         <td className="p-2">
                           <Input
                            className="w-16 h-8 text-center"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                           />
                         </td>
                         <td className="p-2">
                           <Input
                            className="w-24 h-8"
                            value={item.unitOfMeasure}
                            onChange={(e) => updateItem(index, "unitOfMeasure", e.target.value)}
                           />
                         </td>
                         <td className="p-2">
                           <Input
                            className="h-8"
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                           />
                         </td>
                         <td className="p-2">
                           <Input
                            className="w-24 h-8 text-right"
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                           />
                         </td>
                         <td className="p-2">
                           <Input
                            className="w-24 h-8 text-right font-medium bg-muted/50"
                            type="number"
                            readOnly
                            value={item.totalPrice}
                           />
                         </td>
                         <td className="p-2">
                           <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-700 dark:text-red-400 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => removeItem(index)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                   <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={4} className="p-3 text-right font-bold text-muted-foreground">Total Ítems:</td>
                        <td className="p-3 text-right font-bold text-blue-700 dark:text-blue-300">
                          ${items.reduce((acc, item) => acc + (parseFloat(item.totalPrice) || 0), 0).toLocaleString("es-AR")}
                        </td>
                        <td></td>
                      </tr>
                   </tfoot>
                 </table>
               </div>
             )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Crear orden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
