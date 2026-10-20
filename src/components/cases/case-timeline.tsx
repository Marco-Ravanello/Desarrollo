"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Check, FolderOpen, Lock, MessageSquareText, User, UserCheck, X, Clock } from "lucide-react";
import { INTERVENTION_TYPES } from "@/lib/intervention-types";
import type { InterventionRow } from "@/services/interventions";
import type { CaseEvent } from "@/services/case-timeline";
import { InterventionItem, fechaHora } from "@/components/cases/intervention-list";

// Historia completa del expediente: intervenciones, derivaciones con su
// respuesta, apertura y cierre, de lo más nuevo a lo más viejo.

type Item = { kind: "INTERVENCION"; date: string; row: InterventionRow } | { kind: "EVENTO"; date: string; event: CaseEvent };

const NO_TYPE = "SIN_TIPO";
const DERIVACIONES = "DERIVACIONES";
const EXPEDIENTE = "EXPEDIENTE";
const ASIGNACIONES = "ASIGNACIONES";

/** Grupo de cada movimiento para el filtro: el tipo de intervención, derivaciones, profesional a cargo, o apertura y cierre. */
function groupOf(item: Item) {
  if (item.kind === "INTERVENCION") return item.row.type ?? NO_TYPE;
  if (item.event.kind === "ASIGNACION") return ASIGNACIONES;
  return item.event.kind === "DERIVACION" || item.event.kind === "RESPUESTA" ? DERIVACIONES : EXPEDIENTE;
}

function eventIcon(e: CaseEvent) {
  if (e.kind === "APERTURA") return { Icon: FolderOpen, className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" };
  if (e.kind === "CIERRE") return { Icon: Lock, className: "bg-muted text-muted-foreground" };
  if (e.kind === "ASIGNACION") return { Icon: UserCheck, className: "bg-teal-500/15 text-teal-700 dark:text-teal-300" };
  if (e.kind === "RESPUESTA")
    return e.outcome === "RECHAZADA"
      ? { Icon: X, className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" }
      : { Icon: Check, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  return { Icon: ArrowRightLeft, className: "bg-purple-500/15 text-purple-600 dark:text-purple-400" };
}

function EventCard({ e }: { e: CaseEvent }) {
  const { fecha, hora } = fechaHora(e.date);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 p-4 rounded-2xl border border-border/60 bg-muted/10">
      <div className="text-[11px] font-mono font-bold text-muted-foreground flex items-baseline gap-2 sm:min-w-[92px] sm:flex-col sm:items-start sm:justify-center sm:gap-0 sm:border-r sm:border-border/40 sm:pr-3">
        <span>{fecha}</span>
        <span className="text-[10px] opacity-70">{hora}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-bold text-foreground">{e.title}</p>
        {e.author && (
          <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <User className="h-3 w-3" /> {e.author}
          </p>
        )}
        {e.detail && <p className="text-xs text-foreground whitespace-pre-line">{e.detail}</p>}
        {e.kind === "DERIVACION" && e.outcome === "PENDIENTE" && (
          <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <Clock className="h-3 w-3" /> Esperando respuesta
          </p>
        )}
      </div>
    </div>
  );
}

export function CaseTimeline({ interventions, events }: { interventions: InterventionRow[]; events: CaseEvent[] }) {
  const [filter, setFilter] = useState<string>("TODO");

  const items = useMemo<Item[]>(
    () =>
      [
        ...interventions.map((row) => ({ kind: "INTERVENCION" as const, date: row.date, row })),
        ...events.map((event) => ({ kind: "EVENTO" as const, date: event.date, event })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [interventions, events]
  );

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const item of items) c.set(groupOf(item), (c.get(groupOf(item)) ?? 0) + 1);
    return c;
  }, [items]);

  const options = [
    ...INTERVENTION_TYPES.filter((t) => counts.has(t.value)).map((t) => ({ value: t.value as string, label: t.label })),
    ...(counts.has(NO_TYPE) ? [{ value: NO_TYPE, label: "Sin tipo" }] : []),
    ...(counts.has(DERIVACIONES) ? [{ value: DERIVACIONES, label: "Derivaciones" }] : []),
    ...(counts.has(ASIGNACIONES) ? [{ value: ASIGNACIONES, label: "Profesional a cargo" }] : []),
    ...(counts.has(EXPEDIENTE) ? [{ value: EXPEDIENTE, label: "Apertura y cierre" }] : []),
  ];
  const visible = filter === "TODO" ? items : items.filter((item) => groupOf(item) === filter);

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Filtrar la historia">
          {[{ value: "TODO", label: "Todo" }, ...options].map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={filter === o.value}
              onClick={() => setFilter(o.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === o.value ? "border-foreground bg-foreground text-background" : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label} ({o.value === "TODO" ? items.length : counts.get(o.value)})
            </button>
          ))}
        </div>
      )}

      <ol className="relative space-y-3 pl-9 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-border">
        {visible.map((item) => {
          const { Icon, className } =
            item.kind === "INTERVENCION"
              ? { Icon: MessageSquareText, className: "bg-primary/10 text-primary" }
              : eventIcon(item.event);
          return (
            <li key={item.kind === "INTERVENCION" ? item.row.id : item.event.id} className="relative">
              <span className={`absolute -left-9 top-4 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-card ${className}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              {item.kind === "INTERVENCION" ? <InterventionItem row={item.row} /> : <EventCard e={item.event} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
