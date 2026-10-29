import { CalendarClock } from "lucide-react";
import type { AgreementState, AgreementTone } from "@/lib/convenios";

const BADGE: Record<AgreementTone, string> = {
  green: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-300",
  rose: "bg-rose-500/15 text-rose-800 border-rose-500/30 dark:text-rose-300",
  blue: "bg-blue-500/15 text-blue-800 border-blue-500/30 dark:text-blue-300",
  gray: "bg-muted text-muted-foreground border-border/60",
};

const TEXT: Record<AgreementTone, string> = {
  green: "text-muted-foreground",
  amber: "font-semibold text-amber-700 dark:text-amber-300",
  rose: "font-semibold text-rose-700 dark:text-rose-300",
  blue: "text-muted-foreground",
  gray: "text-muted-foreground",
};

/** "Vigente", "En revisión", "Vencido"…, con su color. */
export function AgreementStatusBadge({ state, className = "" }: { state: AgreementState; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${BADGE[state.tone]} ${className}`}>
      {state.label}
    </span>
  );
}

/** "Vence en 20 días" (naranja), "Venció el 03/03/2026" (rojo) u "Hasta el 31/12/2027". */
export function AgreementEndLabel({ state }: { state: AgreementState }) {
  if (!state.endLabel) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${TEXT[state.endTone]}`}>
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden /> {state.endLabel}
    </span>
  );
}
