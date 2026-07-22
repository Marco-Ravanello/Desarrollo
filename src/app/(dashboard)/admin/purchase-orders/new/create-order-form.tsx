"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createPurchaseOrderAction } from "../../actions/create-purchase-order";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, Info } from "lucide-react";
import dynamic from "next/dynamic";

const OCRScanner = dynamic(() => import("@/components/ocr/ocr-scanner").then(mod => mod.OCRScanner), {
  ssr: false,
});

export function CreatePurchaseOrderForm({ providers }: { providers: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState({
    number: "",
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
    // Try to find provider by CUIT if found
    let matchedProviderId = "";
    if (data.cuit) {
      const p = providers.find(p =>
        p.cuit === data.cuit ||
        p.cuit.replace(/-/g, '') === data.cuit.replace(/-/g, '')
      );
      if (p) matchedProviderId = p.id;
    }

    setOrderData(prev => ({
      ...prev,
      number: data.number || prev.number,
      amount: data.amount || prev.amount,
      providerId: matchedProviderId || prev.providerId,
      providerName: data.providerName || prev.providerName,
      providerCuit: data.cuit || prev.providerCuit,
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

    // Validation
    const itemsTotal = items.reduce((acc, item) => acc + (parseFloat(item.totalPrice) || 0), 0);
    const orderTotal = parseFloat(orderData.amount) || 0;

    if (items.length > 0 && Math.abs(itemsTotal - orderTotal) > 0.01) {
      toast.error(`El total de los ítems ($${itemsTotal.toLocaleString()}) no coincide con el total de la orden ($${orderTotal.toLocaleString()})`);
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
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
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Orden</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
           <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Asistente de Carga Rápida</h4>
           <OCRScanner onScanComplete={handleScanComplete} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">Número de Orden</Label>
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
              <Label htmlFor="providerNumber">N° de Proveedor</Label>
              <Input
                id="providerNumber"
                name="providerNumber"
                placeholder="Ej: 20264"
                value={orderData.providerNumber}
                onChange={(e) => setOrderData({...orderData, providerNumber: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="providerName">Nombre del Proveedor</Label>
              <Input
                id="providerName"
                name="providerName"
                placeholder="Ej: Duarte Fernando Gabriel"
                required
                value={orderData.providerName}
                onChange={(e) => setOrderData({...orderData, providerName: e.target.value})}
              />
              <input type="hidden" name="providerId" value={orderData.providerId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="providerCuit">CUIT del Proveedor</Label>
              <Input
                id="providerCuit"
                name="providerCuit"
                placeholder="Ej: 23-25249967-9"
                value={orderData.providerCuit}
                onChange={(e) => setOrderData({...orderData, providerCuit: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Importe Total ($)</Label>
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
              <Label htmlFor="expediente">N° Expediente</Label>
              <Input
                id="expediente"
                name="expediente"
                placeholder="Ej: 312/2026"
                value={orderData.expediente}
                onChange={(e) => setOrderData({...orderData, expediente: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Fecha Estimada de Entrega</Label>
              <Input
                id="deliveryDate"
                name="deliveryDate"
                type="date"
                value={orderData.deliveryDate}
                onChange={(e) => setOrderData({...orderData, deliveryDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryPlace">Lugar de Entrega</Label>
              <Input
                id="deliveryPlace"
                name="deliveryPlace"
                placeholder="Ej: Palacio Municipal"
                value={orderData.deliveryPlace}
                onChange={(e) => setOrderData({...orderData, deliveryPlace: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Condición de Pago</Label>
              <Input
                id="paymentTerms"
                name="paymentTerms"
                placeholder="Ej: 1 Mes"
                value={orderData.paymentTerms}
                onChange={(e) => setOrderData({...orderData, paymentTerms: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Descripción / Motivo</Label>
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
                  <h3 className="text-lg font-semibold">Ítems de la Orden</h3>
                  <div className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                    {items.length} {items.length === 1 ? 'renglón' : 'renglones'}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="text-blue-600 border-blue-200">
                  <Plus className="h-4 w-4 mr-1" /> Agregar Ítem
                </Button>
             </div>

             {items.length === 0 ? (
               <div className="border-2 border-dashed rounded-xl p-8 text-center text-slate-500 bg-slate-50/50">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No hay ítems cargados. Usa el asistente de OCR o agrega uno manualmente.</p>
               </div>
             ) : (
               <div className="border rounded-xl overflow-hidden">
                 <table className="w-full text-sm">
                   <thead className="bg-slate-50 border-b">
                     <tr>
                       <th className="text-left p-3 font-medium text-slate-600">Cant.</th>
                       <th className="text-left p-3 font-medium text-slate-600">Unidad</th>
                       <th className="text-left p-3 font-medium text-slate-600 w-full">Descripción</th>
                       <th className="text-left p-3 font-medium text-slate-600 text-right">Unitario</th>
                       <th className="text-left p-3 font-medium text-slate-600 text-right">Total</th>
                       <th className="p-3"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {items.map((item, index) => (
                       <tr key={index} className="hover:bg-slate-50/50 transition-colors">
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
                            className="w-24 h-8 text-right font-medium bg-slate-50"
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
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeItem(index)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                   <tfoot className="bg-slate-50/50">
                      <tr>
                        <td colSpan={4} className="p-3 text-right font-bold text-slate-600">Total Ítems:</td>
                        <td className="p-3 text-right font-bold text-blue-700">
                          ${items.reduce((acc, item) => acc + (parseFloat(item.totalPrice) || 0), 0).toLocaleString()}
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
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Registrando..." : "Crear Orden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
