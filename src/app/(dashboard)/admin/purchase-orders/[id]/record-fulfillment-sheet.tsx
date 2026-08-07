"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { updateItemFulfillmentAction } from "../../actions/order-fulfillment";

interface RecordFulfillmentSheetProps {
  orderId: string;
  item: {
    id: string;
    description: string;
    quantity: number;
    fulfilledQuantity: number;
    unitOfMeasure: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecordFulfillmentSheet({
  orderId,
  item,
  open,
  onOpenChange,
  onSuccess
}: RecordFulfillmentSheetProps) {
  const [loading, setLoading] = useState(false);
  const [newFulfillment, setNewFulfillment] = useState("0");

  const remaining = item.quantity - item.fulfilledQuantity;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(newFulfillment);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Ingrese una cantidad válida");
      return;
    }

    if (amount > remaining) {
      toast.error("La cantidad supera el saldo pendiente");
      return;
    }

    setLoading(true);
    try {
      const result = await updateItemFulfillmentAction(item.id, amount);
      if (result.success) {
        toast.success("Entrega registrada correctamente");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || "Error al registrar entrega");
      }
    } catch (error) {
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar Entrega</SheetTitle>
          <SheetDescription>
            Actualiza la cantidad recibida para este renglón.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div className="space-y-1">
            <Label className="text-xs uppercase font-bold text-slate-400">Renglón</Label>
            <p className="font-medium text-slate-900 line-clamp-2">{item.description}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total</p>
              <p className="text-lg font-black">{item.quantity} <span className="text-[10px] text-slate-500 font-normal">{item.unitOfMeasure}</span></p>
            </div>
            <div className="text-center border-x">
              <p className="text-[10px] uppercase font-bold text-slate-400">Recibido</p>
              <p className="text-lg font-black text-blue-600">{item.fulfilledQuantity}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Pendiente</p>
              <p className="text-lg font-black text-orange-600">{remaining}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fulfilled">Cantidad Entregada Ahora</Label>
              <div className="relative">
                <Input
                  id="fulfilled"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remaining}
                  value={newFulfillment}
                  onChange={(e) => setNewFulfillment(e.target.value)}
                  className="pr-16 text-lg font-bold h-12"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                  {item.unitOfMeasure}
                </div>
              </div>
            </div>

            {parseFloat(newFulfillment) === remaining && (
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs font-medium">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Esta acción marcará el renglón como COMPLETADO.</span>
              </div>
            )}

            {parseFloat(newFulfillment) > remaining && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-xs font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>La cantidad no puede ser mayor al pendiente ({remaining}).</span>
              </div>
            )}
          </div>

          <SheetFooter className="gap-2 sm:gap-0">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="w-full">Cancelar</Button>
            </SheetClose>
            <Button type="submit" disabled={loading || parseFloat(newFulfillment) <= 0 || parseFloat(newFulfillment) > remaining} className="w-full bg-blue-600 hover:bg-blue-700">
              {loading ? "Guardando..." : "Confirmar Entrega"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
