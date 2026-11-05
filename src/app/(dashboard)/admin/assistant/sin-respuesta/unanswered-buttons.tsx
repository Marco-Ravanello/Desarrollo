"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/confirm-dialog";
import { HIDDEN_NUMBER } from "@/lib/assistant-unanswered";
import { changeUnansweredAction } from "@/app/(dashboard)/admin/actions/assistant-actions";

/** Probar de nuevo, Ya la entiende (o Volver a pendientes) y Borrar, para una pregunta de la lista. */
export function UnansweredButtons({ questionKey, question, view }: { questionKey: string; question: string; view: "pendientes" | "resueltas" }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  // Con un número tapado no tiene sentido mandarla tal cual: se deja escrita igual, para completarla.
  const tryHref = `/admin/assistant?pregunta=${encodeURIComponent(question)}`;

  function change(kind: "resolver" | "reabrir" | "borrar", done: string) {
    start(async () => {
      const res = await changeUnansweredAction(questionKey, kind);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo hacer el cambio. Probá de nuevo.");
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  async function remove() {
    const ok = await confirmar({
      title: "¿Borrar esta pregunta?",
      description: "Se borran todas las veces que se hizo. Si alguien la vuelve a hacer y el asistente no la responde, aparece de nuevo.",
      confirmLabel: "Borrar",
      danger: true,
    });
    if (ok) change("borrar", "Se borró la pregunta.");
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
        <Link href={tryHref} title={question.includes(HIDDEN_NUMBER) ? "Tiene un número tapado: completalo antes de mandarla." : undefined}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Probar de nuevo
        </Link>
      </Button>
      {view === "pendientes" ? (
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={busy} onClick={() => change("resolver", "Listo, quedó en \"Ya las entiende\".")}>
          <Check className="h-3.5 w-3.5" aria-hidden /> Ya la entiende
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={busy} onClick={() => change("reabrir", "Volvió a pendientes.")}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Volver a pendientes
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 text-xs text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
        disabled={busy}
        onClick={remove}
        aria-label={`Borrar la pregunta "${question}"`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Borrar
      </Button>
    </div>
  );
}
