"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Send } from "lucide-react";
import { addCaseInterventionAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { toast } from "sonner";
import { INTERVENTION_TYPES } from "@/lib/intervention-types";

interface QuickInterventionFormProps {
  caseId: string;
  caseTitle: string;
}

export function QuickInterventionForm({ caseId, caseTitle }: QuickInterventionFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) {
      toast.error("Elegí el tipo de intervención");
      return;
    }
    if (!description.trim()) {
      toast.error("Escribí qué se hizo en la intervención");
      return;
    }

    setLoading(true);
    try {
      const result = await addCaseInterventionAction(caseId, description, type);
      if (result.success) {
        toast.success("Intervención registrada correctamente");
        setDescription("");
        setType("");
        setExpanded(false);
      } else {
        toast.error(result.error || "Error al registrar intervención");
      }
    } catch (error) {
      toast.error("No se pudo registrar la intervención. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <Button
        onClick={() => setExpanded(true)}
        className="w-full rounded-2xl bg-primary/10 hover:bg-primary/10 text-primary border border-primary/20 font-bold gap-2 h-11"
      >
        <PlusCircle className="h-4 w-4" /> Nueva intervención
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-card border border-primary/30 shadow-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-muted-foreground">
          Cargar nota de evolución en expediente
        </label>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {caseTitle}
        </span>
      </div>

      <div role="radiogroup" aria-label="Tipo de intervención" className="flex flex-wrap gap-1.5">
        {INTERVENTION_TYPES.filter((t) => t.value !== "EMERGENCIA").map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              type === t.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-muted/30 text-foreground hover:border-primary/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Contá cómo fue la atención, el informe social o la derivación"
        rows={3}
        className="rounded-2xl bg-muted/40 border-border/60 font-medium text-sm focus:ring-1 focus:ring-primary"
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
          className="rounded-xl font-bold text-xs"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="rounded-xl font-bold gap-1.5 text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Guardar intervención
        </Button>
      </div>
    </form>
  );
}
