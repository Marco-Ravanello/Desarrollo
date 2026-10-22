"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateReservationStatusAction } from "../../actions/vehicle-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Ban, Check, Loader2, LogIn, LogOut, X } from "lucide-react";

export type ReservationAction = "APROBADA" | "RECHAZADA" | "CANCELADA" | "EN_CURSO" | "FINALIZADA";

const ACTIONS: Record<ReservationAction, {
  label: string;
  icon: React.ElementType;
  className: string;
  done: string;
  /** Qué se pregunta antes de confirmar. */
  ask?: { title: string; description: string; field: "motivo" | "km" };
}> = {
  APROBADA: {
    label: "Aprobar",
    icon: Check,
    className: "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10",
    done: "Reserva aprobada.",
  },
  RECHAZADA: {
    label: "Rechazar",
    icon: X,
    className: "text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/10",
    done: "Pedido rechazado.",
    ask: { title: "Rechazar el pedido", description: "Quien lo pidió recibe un aviso con el motivo.", field: "motivo" },
  },
  CANCELADA: {
    label: "Cancelar",
    icon: Ban,
    className: "text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/10",
    done: "Reserva cancelada. El vehículo queda libre en ese horario.",
    ask: { title: "Cancelar la reserva", description: "El vehículo queda libre en ese horario para otro pedido.", field: "motivo" },
  },
  EN_CURSO: {
    label: "Salió",
    icon: LogOut,
    className: "",
    done: "Listo: el vehículo figura en uso.",
    ask: { title: "Registrar la salida", description: "El vehículo pasa a figurar en uso hasta que se registre la vuelta.", field: "km" },
  },
  FINALIZADA: {
    label: "Volvió",
    icon: LogIn,
    className: "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10",
    done: "Listo: el vehículo volvió y queda libre.",
    ask: { title: "Registrar la vuelta", description: "La reserva queda finalizada y el vehículo, libre.", field: "km" },
  },
};

/** Botones de una reserva. Cuáles aparecen lo decide el servidor según el rol y el estado. */
export function ReservationActions({ reservationId, actions }: { reservationId: string; actions: ReservationAction[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<ReservationAction | null>(null);
  const [asking, setAsking] = useState<ReservationAction | null>(null);
  const [motivo, setMotivo] = useState("");
  const [km, setKm] = useState("");

  if (actions.length === 0) return null;

  const run = async (status: ReservationAction) => {
    const kmValue = km.trim() ? Number(km.replace(/\./g, "")) : null;
    if (kmValue != null && (!Number.isInteger(kmValue) || kmValue < 0)) {
      toast.error("Escribí los kilómetros como un número entero, o dejalo vacío.");
      return;
    }
    setLoading(status);
    try {
      const res = await updateReservationStatusAction(reservationId, status, motivo.trim() || undefined, kmValue);
      if (res.success) {
        toast.success(ACTIONS[status].done);
        setAsking(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("No se pudo guardar. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(null);
    }
  };

  const ask = asking ? ACTIONS[asking].ask : null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.map((a) => {
        const def = ACTIONS[a];
        const Icon = def.icon;
        return (
          <Button
            key={a}
            size="sm"
            variant="outline"
            className={`rounded-xl text-xs font-bold ${def.className}`}
            disabled={loading !== null}
            onClick={() => {
              if (def.ask) {
                setMotivo("");
                setKm("");
                setAsking(a);
              } else {
                run(a);
              }
            }}
          >
            {loading === a ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Icon className="h-4 w-4 mr-1" />}
            {def.label}
          </Button>
        );
      })}

      <Dialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{ask?.title}</DialogTitle>
            <DialogDescription>{ask?.description}</DialogDescription>
          </DialogHeader>
          {ask?.field === "km" ? (
            <div className="space-y-1.5">
              <Label htmlFor="reserva-km" className="text-xs font-bold text-muted-foreground">Kilómetros que marca el vehículo (opcional)</Label>
              <Input id="reserva-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder="Ej.: 58230" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="reserva-motivo" className="text-xs font-bold text-muted-foreground">Motivo (opcional)</Label>
              <Textarea id="reserva-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAsking(null)} className="rounded-xl font-bold">Volver</Button>
            <Button
              variant={asking === "RECHAZADA" || asking === "CANCELADA" ? "destructive" : "default"}
              disabled={loading !== null}
              onClick={() => asking && run(asking)}
              className="rounded-xl font-bold gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {asking ? ACTIONS[asking].label : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
