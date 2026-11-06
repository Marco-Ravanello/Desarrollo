"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { confirmar } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { PERSON_STATUS_NOTE_MAX } from "@/lib/person-status";
import { clearPersonStatusAction, markPersonStatusAction } from "../actions/person-status-actions";

const OPTIONS = [
  { value: "FALLECIDA", label: "Falleció" },
  { value: "MUDADA", label: "Se mudó fuera del distrito" },
] as const;

/** "Falleció o se mudó": la persona sale de sus programas, de las recorridas y de los avisos. */
export function MarkPersonStatusButton({ dni, nombre, programas, triggerClassName }: { dni: string; nombre: string; programas: string[]; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState<"FALLECIDA" | "MUDADA">("FALLECIDA");
  const [day, setDay] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = () =>
    start(async () => {
      const res = await markPersonStatusAction(dni, estado, day, note);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const partes = [
        res.programas.length ? `salió de ${res.programas.length === 1 ? "1 programa" : `${res.programas.length} programas`}` : null,
        res.visitas ? `de ${res.visitas === 1 ? "1 recorrida" : `${res.visitas} recorridas`}` : null,
      ].filter(Boolean);
      toast.success(`Listo.${partes.length ? ` ${nombre} ${partes.join(" y ")}.` : ""}`);
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={triggerClassName}>
          <UserX className="h-3.5 w-3.5" aria-hidden /> Falleció o se mudó
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Falleció o se mudó fuera del distrito</DialogTitle>
          <DialogDescription>
            {programas.length
              ? `Sale de ${programas.join(", ")}, con la baja y el motivo.`
              : "No está en ningún programa."}{" "}
            También sale de las recorridas que todavía no se hicieron y deja de generar avisos. Sus expedientes quedan como están.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-sm font-medium">Qué pasó</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                    estado === o.value ? "border-primary bg-primary/5" : "border-border/60"
                  )}
                >
                  <input type="radio" name="estado" value={o.value} checked={estado === o.value} onChange={() => setEstado(o.value)} className="accent-[#163C68]" />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="estado-fecha">Desde cuándo (si se sabe)</Label>
            <Input id="estado-fecha" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estado-nota">Nota (opcional)</Label>
            <Textarea id="estado-nota" value={note} maxLength={PERSON_STATUS_NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Cómo se supo, adónde se mudó…" className="rounded-xl" />
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

/** Saca la marca, por si fue un error. Las bajas de los programas quedan. */
export function UndoPersonStatusButton({ dni }: { dni: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const undo = async () => {
    if (
      !(await confirmar({
        title: "¿Sacar la marca?",
        description: "Vuelve a aparecer en las recorridas y los avisos. Las bajas de los programas quedan: si corresponde, dale el alta de nuevo desde Programas.",
        confirmLabel: "Sacar la marca",
      }))
    )
      return;
    start(async () => {
      const res = await clearPersonStatusAction(dni);
      if (!res.success) toast.error(res.error);
      else {
        toast.success("Se sacó la marca.");
        router.refresh();
      }
    });
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={undo} disabled={pending} className="shrink-0 rounded-xl">
      {pending ? "Guardando…" : "Fue un error, sacar la marca"}
    </Button>
  );
}
