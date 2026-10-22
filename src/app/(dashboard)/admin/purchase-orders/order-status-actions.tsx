"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Send, Ban, Loader2, Undo2 } from "lucide-react";
import { updatePurchaseOrderStatusAction } from "../actions/update-order-status";
import { orderStatusLabel } from "@/lib/purchase-orders";
import { toast } from "sonner";

interface ActionDef {
  label: string;
  icon: React.ElementType;
  className: string;
  /** Pide confirmar y deja escribir el motivo. */
  confirm?: string;
}

function actionFor(from: string, to: string): ActionDef {
  const outline = "h-8 text-xs font-bold rounded-xl";
  const danger = `${outline} text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/10`;
  switch (to) {
    case "PENDIENTE_APROBACION":
      return { label: "Enviar a firma", icon: Send, className: outline };
    case "APROBADA":
      return { label: "Aprobar orden", icon: Check, className: outline };
    case "RECHAZADA":
      return { label: "Rechazar", icon: X, className: danger, confirm: "La orden vuelve a quien la cargó, que la puede corregir y enviar de nuevo." };
    case "BORRADOR":
      return { label: from === "RECHAZADA" ? "Volver a borrador para corregir" : "Devolver a borrador", icon: Undo2, className: outline };
    case "CANCELADA":
      return from === "BORRADOR"
        ? { label: "Descartar", icon: Ban, className: danger, confirm: "La orden queda cancelada y no se puede volver a usar." }
        : { label: from === "APROBADA" ? "Cancelar adjudicación" : "Cancelar orden", icon: Ban, className: danger, confirm: "La orden queda cancelada y no se puede volver a usar." };
    default:
      return { label: orderStatusLabel(to), icon: Check, className: outline };
  }
}

/** Botones para cambiar el estado de la orden. Solo aparecen los que el rol puede usar (`allowed` lo calcula el servidor). */
export function OrderStatusActions({ orderId, currentStatus, allowed }: { orderId: string; currentStatus: string; allowed: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (allowed.length === 0) return null;

  async function handleUpdate(newStatus: string, motivo?: string) {
    setLoading(newStatus);
    try {
      const result = await updatePurchaseOrderStatusAction(orderId, newStatus, motivo?.trim() || undefined);
      if (result.success) {
        toast.success(`La orden quedó ${orderStatusLabel(newStatus).toLowerCase()}.`);
        setConfirming(null);
        router.refresh();
      } else {
        toast.error(result.error || "No se pudo cambiar el estado de la orden.");
      }
    } catch {
      toast.error("No se pudo cambiar el estado. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(null);
    }
  }

  const confirmDef = confirming ? actionFor(currentStatus, confirming) : null;

  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((to) => {
        const def = actionFor(currentStatus, to);
        const Icon = def.icon;
        return (
          <Button
            key={to}
            size="sm"
            variant="outline"
            className={def.className}
            disabled={loading !== null}
            onClick={() => {
              if (def.confirm) {
                setReason("");
                setConfirming(to);
              } else {
                handleUpdate(to);
              }
            }}
          >
            {loading === to ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Icon className="h-3.5 w-3.5 mr-1.5" />}
            {def.label}
          </Button>
        );
      })}

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{confirmDef?.label}</DialogTitle>
            <DialogDescription>{confirmDef?.confirm}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="order-reason" className="text-xs font-bold text-muted-foreground">Motivo (queda en la actividad de la orden)</Label>
            <Textarea id="order-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)} className="rounded-xl font-bold">Volver</Button>
            <Button
              variant="destructive"
              disabled={loading !== null}
              onClick={() => confirming && handleUpdate(confirming, reason)}
              className="rounded-xl font-bold gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmDef?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
