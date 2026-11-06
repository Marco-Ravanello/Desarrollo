export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card } from "@/components/ui/card";
import { EmptyMessage } from "@/components/ui/empty-message";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/formato";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { EXPIRY_WARN_DAYS, documentKindLabel, expiryState } from "@/lib/document-kinds";
import { listExpiringDocuments, type ExpiringView } from "@/services/document-expiry";

export const metadata = { title: "Documentos por vencer" };

const tabClass = (active: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:py-1.5",
    active ? "border border-border/40 bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
  );

const TONE = {
  vencido: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  "por-vencer": "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  vigente: "bg-muted text-muted-foreground",
} as const;

/** Los documentos de las personas (el CUD, por ejemplo) que vencen pronto o ya vencieron. */
export default async function DocumentosPorVencerPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await auth();
  const { vista } = await searchParams;
  const view: ExpiringView = vista === "vencidos" ? "vencidos" : "por-vencer";
  const today = todayInArgentina();
  const { docs, porVencer, vencidos } = await listExpiringDocuments(session?.user?.role, view, today);

  return (
    <div className="space-y-4">
      <PageBreadcrumbs items={[{ label: "Registro Único", href: "/people" }, { label: "Documentos por vencer", active: true }]} />
      <PageHeader
        title="Documentos por vencer"
        description={`Los documentos de las personas que vencen en los próximos ${EXPIRY_WARN_DAYS} días o que ya vencieron, como el CUD. Se carga el vencimiento en la pestaña Documentos de cada ficha.`}
        icon={CalendarClock}
      />

      <nav className="flex w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-border/40 bg-muted/30 p-1" aria-label="Qué documentos ver">
        <Link href="/people/vencimientos" className={tabClass(view === "por-vencer")} aria-current={view === "por-vencer" ? "page" : undefined}>
          Por vencer <span className="rounded-md bg-secondary px-1.5 tabular-nums text-secondary-foreground">{porVencer}</span>
        </Link>
        <Link href="/people/vencimientos?vista=vencidos" className={tabClass(view === "vencidos")} aria-current={view === "vencidos" ? "page" : undefined}>
          Vencidos <span className="rounded-md bg-secondary px-1.5 tabular-nums text-secondary-foreground">{vencidos}</span>
        </Link>
      </nav>

      <Card className="overflow-hidden">
        {docs.length === 0 ? (
          <EmptyMessage
            kind="done"
            icon={CalendarClock}
            title={view === "por-vencer" ? `No vence nada en los próximos ${EXPIRY_WARN_DAYS} días` : "No hay documentos vencidos"}
            description="Cuando cargues un documento con fecha de vencimiento en una ficha, aparece acá antes de que venza."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {docs.map((d) => {
              const state = expiryState(d.expiresAt, today);
              const kind = d.kind && d.kind !== "OTRO" ? documentKindLabel(d.kind) : null;
              return (
                <li key={d.id}>
                  <Link
                    href={`/people/${encodeURIComponent(d.dni)}?tab=documentos&doc=${d.id}`}
                    className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground [overflow-wrap:anywhere]">{d.persona}</span>
                      <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {kind ? `${kind}${kind !== d.name ? ` · ${d.name}` : ""}` : d.name}
                        {d.hasFile ? "" : " · sin archivo"} · DNI {d.dni}
                      </span>
                    </span>
                    <span className={cn("w-fit shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", TONE[state.state])}>{state.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {docs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {plural(docs.length, "documento")}. No aparecen los de personas que fallecieron o se mudaron fuera del distrito. La campana avisa un mes antes, una semana
          antes y al vencer a quien cargó el documento y a quien tiene a cargo un expediente de la persona.
        </p>
      )}
    </div>
  );
}
