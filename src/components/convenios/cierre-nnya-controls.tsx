"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, LockOpen, LogOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NNYA_MOTIVO_MAX } from "@/lib/convenio-gasto";
import { AGREEMENT_REASON_MAX } from "@/lib/convenios";
import {
  cerrarPeriodoAction,
  reabrirPeriodoAction,
  registrarEgresoAction,
  vincularExpedienteAction,
  volvioAIngresarAction,
} from "@/app/(dashboard)/convenios/actions";

const selectClass =
  "w-full h-9 px-2 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

const failed = (res: { success: boolean; error?: string } | null) =>
  toast.error(res && !res.success && res.error ? res.error : "No se pudo guardar. Probá de nuevo.");

// ---------------------------------------------------------------------------
// Cierre del período
// ---------------------------------------------------------------------------

export function CerrarPeriodoButton({ agreementId, desde, texto }: { agreementId: string; desde: string; texto: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const close = async () => {
    setSaving(true);
    const res = await cerrarPeriodoAction(agreementId, desde).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Período cerrado.");
    setOpen(false);
    router.refresh();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Lock className="h-4 w-4" /> Cerrar el período
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Cerrar el período del {texto}?</DialogTitle>
          <DialogDescription>
            Quedan fijos los totales. Desde ahí no se pueden cargar, corregir ni borrar horas de esos días, ni cambiar el valor hora que los
            paga. Si hace falta, la conducción lo reabre.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={close} disabled={saving}>
            {saving ? "Cerrando…" : "Cerrar el período"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReabrirPeriodoButton({ agreementId, desde, texto }: { agreementId: string; desde: string; texto: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await reabrirPeriodoAction(agreementId, desde, motivo).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Período reabierto.");
    setOpen(false);
    setMotivo("");
    router.refresh();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <LockOpen className="h-4 w-4" /> Reabrir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reabrir el período del {texto}</DialogTitle>
            <DialogDescription>Se vuelven a poder cambiar sus horas. El motivo queda en la historia del convenio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reabrir-motivo">
              Motivo{" "}
              <span className="text-rose-600" aria-hidden>
                *
              </span>
            </Label>
            <Textarea
              id="reabrir-motivo"
              required
              minLength={3}
              maxLength={AGREEMENT_REASON_MAX}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Faltaban las horas del 03/10 de una cuidadora."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Reabriendo…" : "Reabrir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// NNyA
// ---------------------------------------------------------------------------

export function EgresoButton({
  agreementId,
  nnya,
  today,
}: {
  agreementId: string;
  nnya: { id: string; nombre: string; ingreso: string; ultimoDia: string | null };
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(nnya.ultimoDia ?? today);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await registrarEgresoAction(agreementId, nnya.id, { fecha, motivo }).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success("Egreso registrado.");
    setOpen(false);
    router.refresh();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setFecha(nnya.ultimoDia ?? today);
          setMotivo("");
        }
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg text-xs font-semibold">
          <LogOut className="h-4 w-4" /> Egreso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Egreso de {nnya.nombre}</DialogTitle>
            <DialogDescription>
              Desde el día siguiente no se le cargan horas y deja de contar para la proyección del gasto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`egreso-fecha-${nnya.id}`}>
              Último día de acompañamiento{" "}
              <span className="text-rose-600" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id={`egreso-fecha-${nnya.id}`}
              type="date"
              required
              min={nnya.ultimoDia ?? nnya.ingreso}
              max={today}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`egreso-motivo-${nnya.id}`}>Motivo (opcional)</Label>
            <Input
              id={`egreso-motivo-${nnya.id}`}
              maxLength={NNYA_MOTIVO_MAX}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Alta del hospital, volvió con su familia."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Registrar egreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReingresoButton({ agreementId, nnyaId, nombre }: { agreementId: string; nnyaId: string; nombre: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const run = async () => {
    setSaving(true);
    const res = await volvioAIngresarAction(agreementId, nnyaId).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(`${nombre} vuelve a estar activo. Ya se le pueden cargar horas.`);
    router.refresh();
  };
  return (
    <Button variant="ghost" size="sm" onClick={run} disabled={saving} className="h-8 gap-1 rounded-lg text-xs font-semibold">
      <RotateCcw className="h-4 w-4" /> Volvió a ingresar
    </Button>
  );
}

export function ExpedienteSelect({
  agreementId,
  nnyaId,
  actual,
  opciones,
  nombre,
}: {
  agreementId: string;
  nnyaId: string;
  actual: string | null;
  opciones: { id: string; title: string; area: string; abierto: boolean }[];
  nombre: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const change = async (value: string) => {
    setSaving(true);
    const res = await vincularExpedienteAction(agreementId, nnyaId, value || null).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(value ? "Expediente vinculado." : "Se quitó el expediente.");
    router.refresh();
  };
  return (
    <select
      aria-label={`Expediente de ${nombre}`}
      value={actual ?? ""}
      disabled={saving}
      onChange={(e) => change(e.target.value)}
      className={selectClass}
    >
      <option value="">Sin expediente</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.title} · {o.area}
          {o.abierto ? "" : " (cerrado)"}
        </option>
      ))}
    </select>
  );
}
