"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, Loader2, Pencil, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { INTERVENTION_TYPES, interventionTypeLabel } from "@/lib/intervention-types";
import { editCaseInterventionAction } from "@/app/(dashboard)/cases/actions/case-actions";
import type { InterventionRow } from "@/services/interventions";

export const fechaHora = (iso: string) => {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString("es-AR"),
    hora: d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  };
};

function EditForm({ row, onDone }: { row: InterventionRow; onDone: () => void }) {
  const router = useRouter();
  const [description, setDescription] = useState(row.description);
  const [type, setType] = useState<string>(row.type ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!type) return toast.error("Elegí el tipo de intervención.");
    setSaving(true);
    const res = await editCaseInterventionAction(row.id, description, type).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo corregir. Probá de nuevo.");
    toast.success("Intervención corregida. La versión anterior quedó guardada.");
    onDone();
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Tipo de intervención" className="flex flex-wrap gap-1.5">
        {INTERVENTION_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              type === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-muted/30 text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Textarea
        aria-label="Texto de la intervención"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        className="rounded-xl text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="rounded-xl font-bold gap-1.5">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar corrección
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={saving} className="rounded-xl font-bold">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function InterventionItem({ row }: { row: InterventionRow }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { fecha, hora } = fechaHora(row.date);
  const typeLabel = interventionTypeLabel(row.type);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 p-4 rounded-2xl border border-border/60 bg-muted/20 hover:border-border transition-colors">
      <div className="text-[11px] font-mono font-bold text-muted-foreground flex items-baseline gap-2 sm:min-w-[92px] sm:flex-col sm:items-start sm:justify-center sm:gap-0 sm:border-r sm:border-border/40 sm:pr-3">
        <span>{fecha}</span>
        <span className="text-[10px] opacity-70">{hora}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {typeLabel && (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] font-bold text-primary">
                {typeLabel}
              </Badge>
            )}
            {row.author && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <User className="h-3 w-3" /> {row.author}
              </span>
            )}
            {row.editedAt && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-300"
              >
                <History className="h-3 w-3" /> Corregida {showHistory ? "· ocultar versiones anteriores" : "· ver qué decía antes"}
              </button>
            )}
          </div>
          {row.canEdit && !editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 shrink-0 gap-1 rounded-lg px-2 text-[11px] font-bold">
              <Pencil className="h-3 w-3" /> Corregir
            </Button>
          )}
        </div>
        {editing ? (
          <EditForm row={row} onDone={() => setEditing(false)} />
        ) : (
          <p className="text-sm text-foreground font-medium whitespace-pre-wrap">{row.description}</p>
        )}
        {showHistory && row.edits.length > 0 && (
          <ul className="space-y-2 border-l-2 border-amber-500/40 pl-3">
            {row.edits.map((e) => {
              const when = fechaHora(e.date);
              return (
                <li key={e.id} className="text-xs">
                  <p className="font-semibold text-muted-foreground">
                    Antes de la corrección del {when.fecha} {when.hora}
                    {e.editedBy ? ` (corrigió ${e.editedBy})` : ""}
                    {e.previousType ? ` · ${interventionTypeLabel(e.previousType)}` : ""}:
                  </p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{e.previousDescription}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
