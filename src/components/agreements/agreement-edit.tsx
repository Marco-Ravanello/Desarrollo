"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AGREEMENT_REASON_MAX, AGREEMENT_STATUS_CHANGES, AGREEMENT_STATUS_LABELS } from "@/lib/convenios";
import { changeAgreementStatusAction, updateAgreementAction } from "@/app/(dashboard)/admin/actions/agreement-actions";

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

const failed = (res: { success: boolean; error?: string } | null) =>
  toast.error(res && !res.success && res.error ? res.error : "No se pudo guardar. Probá de nuevo.");

export type AgreementEditable = {
  id: string;
  title: string;
  number: string | null;
  parties: string | null;
  description: string | null;
  amount: number | null;
  startDate: string | null;
  endDate: string | null;
  areaId: string | null;
  status: string;
};

/** Corregir los datos del convenio (la conducción). El estado se cambia aparte, con motivo. */
export function EditAgreementButton({ agreement, areas }: { agreement: AgreementEditable; areas: { id: string; name: string }[] }) {
  const router = useRouter();
  const inicial = () => ({
    title: agreement.title,
    number: agreement.number ?? "",
    parties: agreement.parties ?? "",
    description: agreement.description ?? "",
    amount: agreement.amount !== null ? String(agreement.amount) : "",
    startDate: agreement.startDate ?? "",
    endDate: agreement.endDate ?? "",
    areaId: agreement.areaId ?? "",
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(inicial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = (v: boolean) => {
    if (v) {
      setForm(inicial());
      setError(null);
    }
    setOpen(v);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateAgreementAction(agreement.id, form).catch(() => null);
    setSaving(false);
    if (!res?.success) {
      setError(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
      return;
    }
    toast.success("Datos del convenio guardados.");
    setOpen(false);
    router.refresh();
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Pencil className="h-4 w-4" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Editar el convenio</DialogTitle>
            <DialogDescription>Lo que cambies queda anotado en la historia del convenio.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-title">
                Título u objeto del convenio{" "}
                <span className="text-rose-600" aria-hidden>
                  *
                </span>
              </Label>
              <Input id="edit-title" required value={form.title} onChange={set("title")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-number">Número de convenio o registro</Label>
              <Input id="edit-number" value={form.number} onChange={set("number")} placeholder="Ej: CONV-2026-045" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-parties">
                Partes: con quién se firma{" "}
                <span className="text-rose-600" aria-hidden>
                  *
                </span>
              </Label>
              <Input id="edit-parties" required value={form.parties} onChange={set("parties")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Monto en pesos</Label>
              <Input id="edit-amount" type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-area">Área responsable</Label>
              <select id="edit-area" value={form.areaId} onChange={set("areaId")} className={selectClass}>
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Fecha de inicio</Label>
              <Input id="edit-start" type="date" value={form.startDate} onChange={set("startDate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">Fecha de vencimiento</Label>
              <Input id="edit-end" type="date" min={form.startDate || undefined} value={form.endDate} onChange={set("endDate")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-description">Detalles</Label>
              <Textarea id="edit-description" rows={3} value={form.description} onChange={set("description")} />
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-800 dark:text-rose-200"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_HINTS: Record<string, string> = {
  EN_REVISION: "Se está armando o falta la firma.",
  VIGENTE: "Está firmado y en curso.",
  FINALIZADO: "Terminó como estaba previsto. Ya no se cargan horas.",
  RESCINDIDO: "Se cortó antes de tiempo. Ya no se cargan horas.",
};

/** Cambiar el estado, siempre con el motivo, que queda en la historia. */
export function ChangeAgreementStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const opciones = AGREEMENT_STATUS_CHANGES.filter((s) => s !== status);
  const [open, setOpen] = useState(false);
  const [nuevo, setNuevo] = useState<string>(opciones[0]);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const onOpenChange = (v: boolean) => {
    if (v) {
      setNuevo(opciones[0]);
      setMotivo("");
    }
    setOpen(v);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await changeAgreementStatusAction(id, { status: nuevo, motivo }).catch(() => null);
    setSaving(false);
    if (!res?.success) return failed(res);
    toast.success(`El convenio quedó ${AGREEMENT_STATUS_LABELS[nuevo]?.toLowerCase()}.`);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Cambiar estado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cambiar el estado</DialogTitle>
            <DialogDescription>
              Ahora está {AGREEMENT_STATUS_LABELS[status]?.toLowerCase() ?? status}. El motivo queda en la historia del convenio.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Estado nuevo</legend>
            {opciones.map((o) => (
              <label
                key={o}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm ${nuevo === o ? "border-primary bg-primary/5" : "border-border/60"}`}
              >
                <input
                  type="radio"
                  name="status"
                  value={o}
                  checked={nuevo === o}
                  onChange={() => setNuevo(o)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block font-semibold text-foreground">{AGREEMENT_STATUS_LABELS[o]}</span>
                  <span className="block text-xs text-muted-foreground">{STATUS_HINTS[o]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="status-motivo">
              Motivo{" "}
              <span className="text-rose-600" aria-hidden>
                *
              </span>
            </Label>
            <Textarea
              id="status-motivo"
              required
              minLength={3}
              maxLength={AGREEMENT_REASON_MAX}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Se firmó la adenda el 15/10."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Cambiar estado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
