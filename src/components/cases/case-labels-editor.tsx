"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CASE_LABELS, normalizeCaseLabels } from "@/lib/case-labels";
import { CaseLabelChips } from "@/components/cases/case-label-chips";
import { updateCaseLabelsAction } from "@/app/(dashboard)/cases/actions/case-actions";

/** Botones para prender y apagar cada etiqueta de la lista. */
export function CaseLabelPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(normalizeCaseLabels(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]));
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Etiquetas">
      {CASE_LABELS.map((l) => {
        const on = value.includes(l.key);
        return (
          <button
            key={l.key}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(l.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              on
                ? "border-violet-600 bg-violet-600 text-white dark:border-violet-400 dark:bg-violet-500/30 dark:text-violet-100"
                : "border-border/70 bg-background text-foreground hover:bg-muted"
            )}
          >
            {on && <Check className="h-3 w-3" aria-hidden />}
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

/** Renglón de etiquetas en la página del expediente, con el botón para cambiarlas. */
export function CaseLabelsEditor({ caseId, labels, canEdit }: { caseId: string; labels: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(labels);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await updateCaseLabelsAction(caseId, draft).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success("Etiquetas guardadas.");
    setOpen(false);
    router.refresh();
  };

  if (!canEdit && labels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Tags className="h-3.5 w-3.5" /> Etiquetas
      </span>
      {labels.length > 0 ? (
        <CaseLabelChips labels={labels} linkTo={(k) => `/cases?label=${k}`} />
      ) : (
        <span className="text-xs text-muted-foreground">Ninguna</span>
      )}
      {canEdit && (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setDraft(labels);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs font-bold text-primary">
              {labels.length ? "Cambiar etiquetas" : "Agregar etiquetas"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Etiquetas del expediente</DialogTitle>
              <DialogDescription>
                Sirven para encontrar y contar los expedientes de cada situación. Marcá todas las que correspondan.
              </DialogDescription>
            </DialogHeader>
            <CaseLabelPicker value={draft} onChange={setDraft} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
