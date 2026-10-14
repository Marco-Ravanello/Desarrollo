"use client";

import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmergencyStockItem, StormVictimItem } from "@/types/emergency";
import {
  EMERGENCY_CATEGORIES,
  EmergencyCategoryKey,
  deliveredByCategory,
  pendingByCategory,
  requestedByCategory,
} from "@/lib/emergency-categories";
import { deliverStormItemsAction } from "@/app/(dashboard)/admin/actions/emergency-actions";

interface StormDeliveryDialogProps {
  record: StormVictimItem | null;
  stock: EmergencyStockItem[];
  onOpenChange: (open: boolean) => void;
  onDelivered: () => void;
}

/** Registrar lo que se le entregó a una familia (descuenta del stock). */
export function StormDeliveryDialog({ record, stock, onOpenChange, onDelivered }: StormDeliveryDialogProps) {
  const [quantities, setQuantities] = useState<Record<EmergencyCategoryKey, number>>({ COLCHON: 0, CAMA: 0, CUCHETA: 0, FRAZADA: 0 });
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const available = (key: EmergencyCategoryKey) => stock.find((s) => s.category === key)?.availableStock ?? 0;

  // Por defecto se propone entregar todo lo pendiente que haya en el depósito.
  useEffect(() => {
    if (!record) return;
    const pending = pendingByCategory(record);
    setQuantities({
      COLCHON: Math.min(pending.COLCHON, available("COLCHON")),
      CAMA: Math.min(pending.CAMA, available("CAMA")),
      CUCHETA: Math.min(pending.CUCHETA, available("CUCHETA")),
      FRAZADA: Math.min(pending.FRAZADA, available("FRAZADA")),
    });
    setObservaciones("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  if (!record) return null;

  const requested = requestedByCategory(record);
  const delivered = deliveredByCategory(record);
  const pending = pendingByCategory(record);
  const rows = EMERGENCY_CATEGORIES.filter((c) => requested[c.key] > 0);

  const handleSave = async () => {
    setSaving(true);
    const res = await deliverStormItemsAction(record.id, quantities, observaciones);
    setSaving(false);
    if (res.success) {
      toast.success(
        res.estado === "ENTREGADO"
          ? `Entrega registrada (${res.summary}). La ficha quedó completa.`
          : `Entrega registrada (${res.summary}). Queda pendiente el resto.`
      );
      onOpenChange(false);
      onDelivered();
    } else {
      toast.error(res.error || "No se pudo registrar la entrega");
    }
  };

  return (
    <Dialog open={Boolean(record)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PackageCheck className="h-5 w-5 text-emerald-600" /> Registrar entrega
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {record.nombreApellido} · {record.domicilio}
            {record.barrio ? ` (${record.barrio})` : ""}
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,2.75rem)_4rem] sm:grid-cols-[minmax(0,1fr)_repeat(3,3.5rem)_5rem] gap-2 text-[11px] font-bold uppercase text-muted-foreground px-1">
            <span>Elemento</span>
            <span className="text-center">Pedido</span>
            <span className="text-center">Falta</span>
            <span className="text-center">Stock</span>
            <span className="text-center">Entregar</span>
          </div>
          {rows.map((c) => (
            <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_repeat(3,2.75rem)_4rem] sm:grid-cols-[minmax(0,1fr)_repeat(3,3.5rem)_5rem] items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
              <span className="font-semibold min-w-0 truncate">
                {c.title}
                {delivered[c.key] > 0 && <span className="block text-[11px] font-normal text-muted-foreground">ya entregados: {delivered[c.key]}</span>}
              </span>
              <span className="text-center">{requested[c.key]}</span>
              <span className="text-center font-bold">{pending[c.key]}</span>
              <span className={`text-center ${available(c.key) < pending[c.key] ? "text-rose-600 font-bold" : ""}`}>{available(c.key)}</span>
              <Input
                type="number"
                min={0}
                max={pending[c.key]}
                value={quantities[c.key]}
                disabled={pending[c.key] === 0}
                aria-label={`${c.title} a entregar`}
                onChange={(e) => setQuantities((q) => ({ ...q, [c.key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                className="h-9 min-w-0 rounded-lg text-center font-bold px-1"
              />
            </div>
          ))}

          <div>
            <Label className="text-xs font-bold">Observaciones (opcional)</Label>
            <Input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Quién recibió, vehículo, remito..."
              className="h-10 rounded-xl text-sm mt-1"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Lo que registres se descuenta del stock del depósito y queda anotado en el expediente de la familia.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs font-bold">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
            <PackageCheck className="mr-2 h-4 w-4" />
            {saving ? "Registrando..." : "Registrar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
