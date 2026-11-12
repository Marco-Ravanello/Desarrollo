"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { RequiredMark } from "@/components/ui/form-section";
import { CASE_DESCRIPTION_MAX, CASE_PRIORITIES, CASE_TITLE_MAX, type CasePriority } from "@/lib/case-edit";
import { updateCaseDetailsAction } from "@/app/(dashboard)/cases/actions/case-actions";

/** "Editar expediente": carátula, prioridad y descripción, con lo que cambió en la historia (idea 121). */
export function EditCaseButton({
  caseId,
  title,
  description,
  priority,
}: {
  caseId: string;
  /** La carátula como se ve (sin la marca de tormenta, que se conserva sola). */
  title: string;
  description: string | null;
  priority: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [draftPriority, setDraftPriority] = useState<string>(priority);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setDraftTitle(title);
    setDraftDescription(description ?? "");
    setDraftPriority(priority);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) return toast.error("Escribí la carátula del expediente.");
    setSaving(true);
    const res = await updateCaseDetailsAction(caseId, {
      title: draftTitle,
      description: draftDescription,
      priority: draftPriority,
    }).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success("changed" in res && res.changed ? "Cambios guardados. Quedan en la historia." : "No había nada para cambiar.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl font-bold gap-2">
          <Pencil className="h-4 w-4" /> Editar expediente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Editar expediente</DialogTitle>
            <DialogDescription>
              Lo que cambies queda en la historia del expediente, con quién lo cambió. Si corregís la descripción, la anterior también queda guardada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="edit-case-title" className="text-xs font-bold">Carátula <RequiredMark /></Label>
            <Input
              id="edit-case-title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={CASE_TITLE_MAX}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label id="edit-case-priority" className="text-xs font-bold">Prioridad</Label>
            <div role="radiogroup" aria-labelledby="edit-case-priority" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CASE_PRIORITIES.map((p) => {
                const isSel = draftPriority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    onClick={() => setDraftPriority(p.value as CasePriority)}
                    className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-bold transition-colors ${
                      isSel
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border/60 bg-muted/20 text-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${p.dot} ${isSel ? "ring-2 ring-white/70" : ""}`} aria-hidden />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-case-description" className="text-xs font-bold">Descripción</Label>
            <Textarea
              id="edit-case-description"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              maxLength={CASE_DESCRIPTION_MAX}
              className="min-h-[140px] text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || !draftTitle.trim()} className="rounded-xl font-bold gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
