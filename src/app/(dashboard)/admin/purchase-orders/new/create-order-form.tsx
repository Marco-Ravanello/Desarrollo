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
    expediente: "",
    deliveryDate: "",
    deliveryPlace: "",
    paymentTerms: "",
    description: ""
  });

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
      expediente: data.expediente || prev.expediente,
      deliveryDate: data.deliveryDate ? data.deliveryDate.split('/').reverse().join('-') : prev.deliveryDate,
      deliveryPlace: data.deliveryPlace || prev.deliveryPlace,
      paymentTerms: data.paymentTerms || prev.paymentTerms,
      description: data.description || prev.description
    }));

    if (data.number || data.amount || data.cuit || data.providerName || data.expediente || data.description) {
        toast.success("Datos extraídos correctamente");
    } else {
        toast.warning("No se detectaron campos conocidos en el documento");
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

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
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Detalle de la compra..."
                value={orderData.description}
                onChange={(e) => setOrderData({...orderData, description: e.target.value})}
              />
            </div>
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
