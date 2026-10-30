"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSection, RequiredNote, fieldSelectClass } from "@/components/ui/form-section";
import { toast } from "sonner";
import { createPurchaseOrderAction } from "../../actions/create-purchase-order";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Info,
  MessageSquareText,
  Plus,
  ScanLine,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { EmptyMessage } from "@/components/ui/empty-message";
import dynamic from "next/dynamic";
import type { ProviderOption } from "@/services/providers";
import { ProviderPicker } from "./provider-picker";
import { formatPesos, formatPesosExactos, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

const OCRScanner = dynamic(() => import("@/components/ocr/ocr-scanner").then((mod) => mod.OCRScanner), {
  ssr: false,
});

export function CreatePurchaseOrderForm({
  providers,
  areas = [],
}: {
  providers: ProviderOption[];
  areas?: { id: string; name: string }[];
}) {
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
    description: "",
  });

  const [items, setItems] = useState<any[]>([]);

  const handleScanComplete = (data: any) => {
    // Si el CUIT leído es de un proveedor dado de alta, se usa ese.
    const scannedCuit = String(data.cuit || "").replace(/[^0-9]/g, "");
    const matched = scannedCuit ? providers.find((p) => p.cuit.replace(/[^0-9]/g, "") === scannedCuit) : undefined;

    setOrderData((prev) => ({
      ...prev,
      number: data.number || prev.number,
      amount: data.amount || prev.amount,
      providerId: matched?.id || (data.providerName || data.cuit ? "" : prev.providerId),
      providerName: matched?.name || data.providerName || prev.providerName,
      providerCuit: matched?.cuit || data.cuit || prev.providerCuit,
      providerNumber: data.providerNumber || prev.providerNumber,
      expediente: data.expediente || prev.expediente,
      deliveryDate: data.deliveryDate ? data.deliveryDate.split("/").reverse().join("-") : prev.deliveryDate,
      deliveryPlace: data.deliveryPlace || prev.deliveryPlace,
      paymentTerms: data.paymentTerms || prev.paymentTerms,
      description: data.description || prev.description,
    }));

    if (data.items && data.items.length > 0) {
      setItems(data.items);
    }

    if (
      data.number ||
      data.amount ||
      data.cuit ||
      data.providerName ||
      data.providerNumber ||
      data.expediente ||
      data.description ||
      (data.items && data.items.length > 0)
    ) {
      toast.success("Leímos la orden", { description: "Revisá los datos antes de guardar." });
    } else {
      toast.warning("No encontramos datos de una orden en ese archivo");
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
    if (items.length > 0 && !totalsMatch) {
      toast.error(`El total de los ítems (${formatPesos(itemsTotal)}) no coincide con el total de la orden (${formatPesos(orderTotal)})`);
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("areaId", orderData.areaId);
    formData.append("items", JSON.stringify(items));

    try {
      const result = await createPurchaseOrderAction(formData);
      if (result.success) {
        toast.success("Orden guardada");
        router.push("/admin/purchase-orders");
      } else {
        toast.error(result.error || "No se pudo guardar la orden.");
      }
    } catch (error) {
      toast.error("No se pudo guardar la orden. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const itemsTotal = items.reduce((acc, item) => acc + (parseFloat(item.totalPrice) || 0), 0);
  const orderTotal = parseFloat(orderData.amount) || 0;
  const totalsMatch = Math.abs(itemsTotal - orderTotal) <= 0.01;
  const set = (field: keyof typeof orderData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setOrderData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">¿Tenés la orden escaneada o en PDF?</p>
            <p className="text-xs text-muted-foreground">Subila y completamos los datos y los ítems. Después revisalos antes de guardar.</p>
          </div>
        </div>
        <OCRScanner onScanComplete={handleScanComplete} label="Leer la orden" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <FormSection title="Datos de la orden" description="El número y el importe que figuran en la orden." icon={FileText}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número de orden" htmlFor="number" required>
              <Input id="number" name="number" placeholder="Ej: OC-2026-001" required value={orderData.number} onChange={set("number")} />
            </Field>
            <Field label="Importe total ($)" htmlFor="amount" required>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0,00"
                required
                value={orderData.amount}
                onChange={set("amount")}
              />
            </Field>
            <Field label="Área que la pide" htmlFor="areaId">
              <select id="areaId" value={orderData.areaId} onChange={set("areaId")} className={fieldSelectClass}>
                <option value="">Sin área</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="N° de expediente" htmlFor="expediente">
              <Input
                id="expediente"
                name="expediente"
                placeholder="Ej: 312/2026"
                value={orderData.expediente}
                onChange={set("expediente")}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Proveedor" description="Buscalo en la lista o escribilo a mano si todavía no está." icon={Building2}>
          <ProviderPicker
            providers={providers}
            value={{ providerId: orderData.providerId, providerName: orderData.providerName, providerCuit: orderData.providerCuit }}
            onChange={(p) => setOrderData((prev) => ({ ...prev, ...p }))}
            onPick={(p) => setOrderData((prev) => ({ ...prev, providerNumber: p.lastNumber || prev.providerNumber }))}
          />
          <Field
            label="N° de proveedor"
            htmlFor="providerNumber"
            hint="El número que le da la Municipalidad. Si ya tuvo órdenes, se completa solo."
          >
            <Input
              id="providerNumber"
              name="providerNumber"
              placeholder="Ej: 20264"
              value={orderData.providerNumber}
              onChange={set("providerNumber")}
            />
          </Field>
        </FormSection>

        <FormSection title="Entrega y pago" description="Cuándo y dónde se entrega, y cómo se paga." icon={Truck}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha estimada de entrega" htmlFor="deliveryDate">
              <Input id="deliveryDate" name="deliveryDate" type="date" value={orderData.deliveryDate} onChange={set("deliveryDate")} />
            </Field>
            <Field label="Condición de pago" htmlFor="paymentTerms">
              <Input
                id="paymentTerms"
                name="paymentTerms"
                placeholder="Ej: 30 días"
                value={orderData.paymentTerms}
                onChange={set("paymentTerms")}
              />
            </Field>
            <Field label="Lugar de entrega" htmlFor="deliveryPlace" className="sm:col-span-2">
              <Input
                id="deliveryPlace"
                name="deliveryPlace"
                placeholder="Ej: Palacio Municipal"
                value={orderData.deliveryPlace}
                onChange={set("deliveryPlace")}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Para qué es la compra"
          description="Una o dos líneas para que se entienda sin abrir la orden."
          icon={MessageSquareText}
        >
          <Field label="Motivo" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Ej: Alimentos para los comedores del barrio Fuerte Apache."
              value={orderData.description}
              onChange={set("description")}
            />
          </Field>
        </FormSection>
      </div>

      <FormSection
        title="Qué se compra"
        description={
          items.length === 0
            ? "Podés guardar la orden sin ítems y cargarlos después."
            : `${plural(items.length, "renglón", "renglones")}. La suma tiene que dar el importe total de la orden.`
        }
        icon={ShoppingCart}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agregar renglón
          </Button>
        }
      >
        {items.length === 0 ? (
          <EmptyMessage
            icon={Info}
            compact
            title="Todavía no hay ítems en la orden"
            description="Agregá uno a mano o leé la orden escaneada para cargarlos solos."
            className="rounded-xl border-2 border-dashed border-border/60"
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border/60 bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium text-muted-foreground">Cantidad</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Unidad</th>
                  <th className="w-full p-3 text-left font-medium text-muted-foreground">Qué se compra</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Precio unitario</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Subtotal</th>
                  <th className="p-3">
                    <span className="sr-only">Quitar</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="p-2">
                      <Input
                        aria-label={`Cantidad del renglón ${index + 1}`}
                        className="h-9 w-20 text-center"
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label={`Unidad del renglón ${index + 1}`}
                        className="h-9 w-24"
                        value={item.unitOfMeasure}
                        onChange={(e) => updateItem(index, "unitOfMeasure", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label={`Descripción del renglón ${index + 1}`}
                        className="h-9 min-w-[12rem]"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        aria-label={`Precio unitario del renglón ${index + 1}`}
                        className="h-9 w-28 text-right"
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                      />
                    </td>
                    <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums text-foreground">
                      {formatPesosExactos(parseFloat(item.totalPrice) || 0)}
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar el renglón ${index + 1}`}
                        className="h-8 w-8 text-red-700 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border/60 bg-muted/30">
                <tr>
                  <td colSpan={4} className="p-3 text-right font-semibold text-muted-foreground">
                    Suma de los ítems
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-foreground">
                    {formatPesosExactos(itemsTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {items.length > 0 && orderTotal > 0 && (
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              totalsMatch ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
            )}
          >
            {totalsMatch ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {totalsMatch
              ? "La suma coincide con el importe total."
              : `La suma da ${formatPesosExactos(itemsTotal)} y el importe total es ${formatPesosExactos(orderTotal)}. Tienen que coincidir para guardar.`}
          </p>
        )}
      </FormSection>

      <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <RequiredNote />
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando…" : "Guardar orden"}
          </Button>
        </div>
      </div>
    </form>
  );
}
