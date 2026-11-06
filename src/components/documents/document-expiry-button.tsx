"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DOCUMENT_KINDS } from "@/lib/document-kinds";
import { setDocumentExpiryAction } from "@/app/(dashboard)/people/actions/upload-document";

/** Cambiar el tipo y el vencimiento de un documento (por ejemplo, cuando se renueva el CUD). */
export function DocumentExpiryButton({ id, name, kind, expiresAt }: { id: string; name: string; kind: string | null; expiresAt: string | null }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(kind ?? "OTRO");
  const [day, setDay] = useState(expiresAt ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = () =>
    start(async () => {
      const res = await setDocumentExpiryAction(id, k, day);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(day ? "Vencimiento guardado." : "Se sacó el vencimiento.");
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs font-bold">
          <CalendarClock className="h-4 w-4" aria-hidden /> {expiresAt ? "Cambiar vencimiento" : "Agregar vencimiento"}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vencimiento del documento</DialogTitle>
          <DialogDescription className="[overflow-wrap:anywhere]">
            {name}. La app avisa en la campana un mes antes, una semana antes y cuando vence, a quien lo cargó y a quien tiene a cargo un expediente de la persona.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`doc-kind-${id}`}>Tipo de documento</Label>
            <select
              id={`doc-kind-${id}`}
              value={k}
              onChange={(e) => setK(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {DOCUMENT_KINDS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`doc-day-${id}`}>Vence el</Label>
            <Input id={`doc-day-${id}`} type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-xl" />
            <p className="text-xs text-muted-foreground">Dejalo vacío si no vence.</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={pending} className="gap-2 font-bold">
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
