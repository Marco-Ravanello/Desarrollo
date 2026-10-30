import { CalendarClock } from "lucide-react";
import type { AgreementState, AgreementTone } from "@/lib/convenios";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusTone } from "@/lib/status-tones";

const BADGE_TONE: Record<AgreementTone, StatusTone> = {
  green: "green",
  amber: "amber",
  rose: "red",
  blue: "blue",
  gray: "slate",
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
    <StatusBadge tone={BADGE_TONE[state.tone]} className={className}>
      {state.label}
    </StatusBadge>
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
