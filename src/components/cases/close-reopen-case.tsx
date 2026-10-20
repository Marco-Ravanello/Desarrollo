"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { closeCaseAction, reopenCaseAction } from "@/app/(dashboard)/people/actions/close-case";
import { CASE_REASON_MAX } from "@/lib/case-closing";

const TEXT = {
  close: {
    button: "Cerrar expediente",
    short: "Cerrar",
    title: "Cerrar el expediente",
    description: "El motivo queda en la historia del expediente. Si hace falta, se puede reabrir después.",
    placeholder: "Ej: Se resolvió lo que motivó la consulta.",
    ok: "Expediente cerrado.",
  },
  reopen: {
    button: "Reabrir expediente",
    short: "Reabrir",
    title: "Reabrir el expediente",
    description: "Vuelve a quedar abierto con su historia completa. El motivo queda registrado.",
    placeholder: "Ej: La familia volvió a consultar por la misma situación.",
    ok: "Expediente reabierto.",
  },
};

/** Botón con diálogo para cerrar o reabrir un expediente con un motivo obligatorio. */
export function CloseReopenCaseButton({
  caseId,
  mode,
  compact = false,
}: {
  caseId: string;
  mode: "close" | "reopen";
  /** Botón chico, para listas. */
  compact?: boolean;
}) {
  const router = useRouter();
  const t = TEXT[mode];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const Icon = mode === "close" ? CheckCircle2 : RotateCcw;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Escribí el motivo.");
    setSaving(true);
    const action = mode === "close" ? closeCaseAction : reopenCaseAction;
    const res = await action(caseId, reason).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success(t.ok);
    setOpen(false);
    setReason("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-700 dark:text-green-300"
          >
            <Icon className="h-3 w-3 mr-1" /> {t.short}
          </Button>
        ) : (
          <Button variant="outline" className="rounded-xl font-bold gap-1.5">
            <Icon className="h-4 w-4" /> {t.button}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`motivo-${mode}`} className="text-xs font-bold">Motivo</Label>
            <Textarea
              id={`motivo-${mode}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={CASE_REASON_MAX}
              placeholder={t.placeholder}
              className="min-h-[100px] text-sm"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !reason.trim()} className="rounded-xl font-bold gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t.short}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
