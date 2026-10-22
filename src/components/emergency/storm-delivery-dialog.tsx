"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, PackageCheck, Printer } from "lucide-react";
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
  pendingExtras,
  requestedByCategory,
  requestedExtras,
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
  const [otros, setOtros] = useState<Record<string, number>>({});
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  // Entrega recién registrada: se ofrece imprimir la constancia para que firme quien recibe.
  const [done, setDone] = useState<{ deliveryId: string; summary: string; complete: boolean } | null>(null);

  const available = (key: EmergencyCategoryKey) => stock.find((s) => s.category === key)?.availableStock ?? 0;
  const extraStock = (id: string) => stock.find((s) => s.id === id);

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
    setOtros(
      Object.fromEntries(
        Object.entries(pendingExtras(record)).map(([id, n]) => [id, Math.min(n, extraStock(id)?.availableStock ?? 0)])
      )
    );
    setObservaciones("");
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  if (!record) return null;

  const requested = requestedByCategory(record);
  const delivered = deliveredByCategory(record);
  const pending = pendingByCategory(record);
  // Una fila por elemento pedido: los de siempre y los otros insumos de la ficha.
  const otrosRequested = requestedExtras(record);
  const otrosPending = pendingExtras(record);
  const rows = [
    ...EMERGENCY_CATEGORIES.filter((c) => requested[c.key] > 0).map((c) => ({
      id: c.key as string,
      title: c.title,
      requested: requested[c.key],
      delivered: delivered[c.key],
      pending: pending[c.key],
      stock: available(c.key),
      value: quantities[c.key],
      set: (n: number) => setQuantities((q) => ({ ...q, [c.key]: n })),
    })),
    ...Object.entries(otrosRequested).map(([id, n]) => ({
      id,
      title: extraStock(id)?.name || "Insumo eliminado",
      requested: n,
      delivered: record.entregadoOtros?.[id] || 0,
      pending: otrosPending[id] || 0,
      stock: extraStock(id)?.availableStock ?? 0,
      value: otros[id] || 0,
      set: (v: number) => setOtros((o) => ({ ...o, [id]: v })),
    })),
  ];

  const handleSave = async () => {
    setSaving(true);
    const res = await deliverStormItemsAction(record.id, quantities, observaciones, otros);
    setSaving(false);
    if (res.success) {
      setDone({ deliveryId: res.deliveryId!, summary: res.summary!, complete: res.estado === "ENTREGADO" });
      onDelivered();
    } else {
      toast.error(res.error || "No se pudo registrar la entrega");
    }
  };

  if (done) {
    return (
      <Dialog open={Boolean(record)} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Entrega registrada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-bold">{record.nombreApellido}</span> recibió {done.summary}.
            </p>
            <p className="text-muted-foreground">
              {done.complete ? "La ficha quedó completa." : "Queda pendiente el resto de lo pedido."} Imprimí la constancia para que firme quien
              recibe.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs font-bold">
              Cerrar
            </Button>
            <Button asChild className="rounded-xl text-xs font-bold">
              <Link href={`/admin/emergency/constancia/${done.deliveryId}`} target="_blank">
                <Printer className="mr-2 h-4 w-4" /> Imprimir constancia
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
            <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_repeat(3,2.75rem)_4rem] sm:grid-cols-[minmax(0,1fr)_repeat(3,3.5rem)_5rem] items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
              <span className="font-semibold min-w-0 break-words">
                {c.title}
                {c.delivered > 0 && <span className="block text-[11px] font-normal text-muted-foreground">ya entregados: {c.delivered}</span>}
              </span>
              <span className="text-center">{c.requested}</span>
              <span className="text-center font-bold">{c.pending}</span>
              <span className={`text-center ${c.stock < c.pending ? "text-rose-600 font-bold" : ""}`}>{c.stock}</span>
              <Input
                type="number"
                min={0}
                max={c.pending}
                value={c.value}
                disabled={c.pending === 0}
                aria-label={`${c.title} a entregar`}
                onChange={(e) => c.set(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
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
          <Button onClick={handleSave} disabled={saving} className="rounded-xl text-xs font-bold">
            <PackageCheck className="mr-2 h-4 w-4" />
            {saving ? "Registrando..." : "Registrar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
