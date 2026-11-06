"use client";

import { useEffect, useRef, useState } from "react";
import { ABRIR_NUEVA_INTERVENCION } from "@/lib/atajos";
import { pedidoDeIntervencion } from "@/components/cases/new-intervention-signal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PencilLine, Loader2, Send } from "lucide-react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [focusNext, setFocusNext] = useState(false);

  // El botón "Nueva intervención" del encabezado abre el formulario y lleva hasta él.
  useEffect(() => {
    const open = () => {
      pedidoDeIntervencion.pendiente = false;
      setExpanded(true);
      setFocusNext(true);
    };
    // Si se pidió desde otra pestaña, el formulario aparece recién ahora.
    if (pedidoDeIntervencion.pendiente) open();
    window.addEventListener(ABRIR_NUEVA_INTERVENCION, open);
    return () => window.removeEventListener(ABRIR_NUEVA_INTERVENCION, open);
  }, []);
  useEffect(() => {
    if (!expanded || !focusNext) return;
    setFocusNext(false);
    const t = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(t);
  }, [expanded, focusNext]);

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
        toast.success("Intervención guardada.");
        setDescription("");
        setType("");
        setExpanded(false);
      } else {
        toast.error(result.error || "No se pudo guardar la intervención. Probá de nuevo.");
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
        onClick={() => {
          setExpanded(true);
          setFocusNext(true);
        }}
        variant="outline"
        className="h-11 w-full justify-start gap-2 rounded-2xl border-dashed border-primary/30 bg-card font-medium text-muted-foreground hover:bg-primary/5 hover:text-foreground"
      >
        {/* Parece un campo para escribir: así no repite el botón "Nueva intervención" del encabezado. */}
        <PencilLine className="h-4 w-4 text-primary" aria-hidden /> Escribir una intervención…
      </Button>
    );
  }

  return (
    <form ref={formRef} id="nueva-intervencion" onSubmit={handleSubmit} className="p-4 rounded-2xl bg-card border border-primary/30 shadow-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-muted-foreground">
          Nueva intervención
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
        ref={textRef}
        aria-label="Qué se hizo"
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
