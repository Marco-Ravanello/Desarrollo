"use client";

import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { updatePurchaseOrderStatusAction } from "../actions/update-order-status";
import { toast } from "sonner";
import { useState } from "react";

export function OrderStatusActions({ orderId, currentStatus }: { orderId: string, currentStatus: string }) {
  const [loading, setLoading] = useState(false);

  if (currentStatus !== 'PENDIENTE_APROBACION') return null;

  async function handleUpdate(newStatus: string) {
    setLoading(true);
    try {
      const result = await updatePurchaseOrderStatusAction(orderId, newStatus);
      if (result.success) {
        toast.success(`Orden ${newStatus === 'APROBADA' ? 'aprobada' : 'rechazada'}`);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
        onClick={() => handleUpdate('APROBADA')}
        disabled={loading}
      >
        <Check className="h-4 w-4 mr-1" /> Aprobar
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        onClick={() => handleUpdate('RECHAZADA')}
        disabled={loading}
      >
        <X className="h-4 w-4 mr-1" /> Rechazar
      </Button>
    </div>
  );
}
