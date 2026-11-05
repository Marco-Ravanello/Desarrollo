"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarCheck, Car, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAssistantProposalAction } from "@/app/(dashboard)/admin/actions/assistant-actions";

export type AssistantProposalData = {
  kind: "tarea" | "reserva";
  detalle?: { label: string; value: string }[];
  [key: string]: unknown;
};

type State = { step: "idle" } | { step: "done"; message: string; link: string } | { step: "cancelled" } | { step: "error"; message: string };

/**
 * La tarjeta de lo que armó el asistente (una tarea o un pedido de vehículo). Nada se guarda hasta "Confirmar",
 * y al confirmar se revisa todo de nuevo en el servidor.
 */
export function AssistantProposal({ proposal }: { proposal: AssistantProposalData }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "idle" });
  const [pending, startTransition] = useTransition();
  const isTask = proposal.kind === "tarea";
  const Icon = isTask ? CalendarCheck : Car;

  const confirm = () =>
    startTransition(async () => {
      const res = await confirmAssistantProposalAction(proposal);
      setState(res.ok ? { step: "done", message: res.message, link: res.link } : { step: "error", message: res.error });
    });

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {isTask ? "Tarea nueva" : "Pedido de vehículo"}
        {state.step === "idle" && <span className="ml-auto text-xs font-normal text-muted-foreground">Sin guardar</span>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
        {(proposal.detalle ?? []).map((d) => (
          <div key={d.label} className="contents">
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd className="font-medium text-foreground">{d.value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border/60 px-4 py-3">
        {state.step === "idle" || state.step === "error" ? (
          <>
            {state.step === "error" && (
              <p className="mb-2 text-sm text-rose-700 dark:text-rose-300" role="alert">
                {state.message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={confirm} disabled={pending} className="h-8 gap-1.5">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
                Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setState({ step: "cancelled" })} disabled={pending} className="h-8 gap-1.5">
                <X className="h-3.5 w-3.5" aria-hidden />
                Cancelar
              </Button>
            </div>
          </>
        ) : state.step === "done" ? (
          <div className="flex flex-wrap items-center gap-2" role="status">
            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" aria-hidden />
              {state.message}
            </p>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => router.push(state.link)}>
              {isTask ? "Ver Mis tareas" : "Ver vehículos"}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Cancelado: no se guardó nada.
          </p>
        )}
      </div>
    </div>
  );
}
