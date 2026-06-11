"use client";

import { useState } from "react";
import { updateReservationStatusAction } from "../../actions/vehicle-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export function ReservationActions({ reservationId }: { reservationId: string }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (status: 'APROBADA' | 'RECHAZADA') => {
    setLoading(true);
    const res = await updateReservationStatusAction(reservationId, status);
    if (res.success) {
      toast.success(`Reserva ${status.toLowerCase()}`);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
        onClick={() => handleAction('APROBADA')}
        disabled={loading}
      >
        <Check className="h-4 w-4 mr-1" /> Aprobar
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-rose-600 border-rose-200 hover:bg-rose-50"
        onClick={() => handleAction('RECHAZADA')}
        disabled={loading}
      >
        <X className="h-4 w-4 mr-1" /> Rechazar
      </Button>
    </div>
  );
}
