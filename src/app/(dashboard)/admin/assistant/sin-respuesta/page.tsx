export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquareWarning } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { cn } from "@/lib/utils";
import { formatFechaHora } from "@/lib/fechas";
import { plural } from "@/lib/formato";
import { roleLabel } from "@/lib/roles";
import { getAreaShortName } from "@/lib/area-theme";
import { UNANSWERED_RETENTION_DAYS } from "@/lib/assistant-unanswered";
import { listUnanswered, type UnansweredView } from "@/services/assistant/unanswered";
import { UnansweredButtons } from "./unanswered-buttons";

export const metadata = { title: "Preguntas sin respuesta" };

const tabClass = (active: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:py-1.5",
    active ? "border border-border/40 bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
  );

/** Las preguntas que el Asistente de IA no pudo responder, juntas por pregunta. Solo el Superadmin. */
export default async function UnansweredPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (session.user.role !== "SUPERADMIN") redirect("/admin/assistant");

  const { vista } = await searchParams;
  const view: UnansweredView = vista === "resueltas" ? "resueltas" : "pendientes";
  const { groups, pending, resolved } = await listUnanswered(view);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Preguntas sin respuesta"
        description="Las preguntas que el asistente no entendió o con las que dio error. Se anotan solas, sin la respuesta ni el nombre de quien preguntó."
        icon={MessageSquareWarning}
        actions={
          // En el celular ya está "Volver a Asistente de IA" arriba.
          <Button asChild variant="outline" className="hidden gap-2 sm:inline-flex">
            <Link href="/admin/assistant">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al asistente
            </Link>
          </Button>
        }
      />

      <nav className="flex w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-border/40 bg-muted/30 p-1" aria-label="Qué preguntas ver">
        <Link href="/admin/assistant/sin-respuesta" className={tabClass(view === "pendientes")} aria-current={view === "pendientes" ? "page" : undefined}>
          Pendientes <span className="rounded-md bg-secondary px-1.5 tabular-nums text-secondary-foreground">{pending}</span>
        </Link>
        <Link href="/admin/assistant/sin-respuesta?vista=resueltas" className={tabClass(view === "resueltas")} aria-current={view === "resueltas" ? "page" : undefined}>
          Ya las entiende <span className="rounded-md bg-secondary px-1.5 tabular-nums text-secondary-foreground">{resolved}</span>
        </Link>
      </nav>

      <Card className="overflow-hidden">
        {groups.length === 0 ? (
          <EmptyMessage
            kind="done"
            title={view === "pendientes" ? "No hay preguntas sin respuesta" : "Todavía no marcaste ninguna"}
            description={
              view === "pendientes"
                ? "Cuando el asistente no pueda responder una pregunta, va a aparecer acá."
                : "Cuando una pregunta ya se pueda responder, tocá \"Ya la entiende\" y queda en esta lista."
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {groups.map((g) => {
              const who = g.askers.map((a) => (a.areaName ? `${roleLabel(a.role)} (${getAreaShortName(a.areaName)})` : roleLabel(a.role)));
              return (
                <li key={g.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">“{g.question}”</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className={cn("font-semibold tabular-nums", g.times > 1 && "text-[#C2410C] dark:text-muni-orange")}>
                        {g.times === 1 ? "1 vez" : plural(g.times, "vez", "veces")}
                      </span>
                      <span>{g.times === 1 ? "El " : "La última, el "}{formatFechaHora(g.lastAt)}</span>
                      <span>
                        {g.errors === 0 ? "No la entendió" : g.errors === g.times ? "Dio error" : `No la entendió · dio error ${g.errors === 1 ? "1 vez" : `${g.errors} veces`}`}
                      </span>
                      {view === "resueltas" && g.resolvedAt && <span>Marcada el {formatFechaHora(g.resolvedAt)}</span>}
                    </p>
                    {who.length > 0 && <p className="text-xs text-muted-foreground">Preguntó: {who.join(" · ")}</p>}
                  </div>
                  <UnansweredButtons questionKey={g.key} question={g.question} view={view} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Solo vos ves esta lista. Los números de 7 cifras o más (DNI, teléfonos) se guardan tapados. Cada pregunta se borra sola {UNANSWERED_RETENTION_DAYS} días
        después de hecha.
      </p>
    </div>
  );
}
