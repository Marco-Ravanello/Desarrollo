"use client";

import { Button } from "@/components/ui/button";
import { Check, X, Send, Ban, Loader2 } from "lucide-react";
import { updatePurchaseOrderStatusAction } from "../actions/update-order-status";
import { toast } from "sonner";
import { useState } from "react";

export function OrderStatusActions({ orderId, currentStatus }: { orderId: string, currentStatus: string }) {
  const [loading, setLoading] = useState(false);

  async function handleUpdate(newStatus: string) {
    setLoading(true);
    try {
      const result = await updatePurchaseOrderStatusAction(orderId, newStatus);
      if (result.success) {
        toast.success(`Estado de la orden actualizado a ${newStatus}`);
      } else {
        toast.error(result.error || "Error al actualizar la orden");
      }
    } catch (e) {
      toast.error("Error inesperado al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus === "BORRADOR") {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
          onClick={() => handleUpdate("PENDIENTE_APROBACION")}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
          Enviar a Firma
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
          onClick={() => handleUpdate("CANCELADA")}
          disabled={loading}
        >
          <Ban className="h-3.5 w-3.5 mr-1.5" /> Descartar
        </Button>
      </div>
    );
  }

  if (currentStatus === "PENDIENTE_APROBACION") {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-300 rounded-xl"
          onClick={() => handleUpdate("APROBADA")}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          Aprobar Orden
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-300 rounded-xl"
          onClick={() => handleUpdate("RECHAZADA")}
          disabled={loading}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Rechazar
        </Button>
      </div>
    );
  }

  if (currentStatus === "APROBADA") {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
          onClick={() => handleUpdate("CANCELADA")}
          disabled={loading}
        >
          <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar Adjudicación
        </Button>
      </div>
    );
  }

  return null;
}
