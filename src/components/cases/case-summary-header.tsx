import Link from "next/link";
import { AlertTriangle, CalendarClock, Clock, Landmark, MessageSquareText, User, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCaseStatusConfig } from "@/lib/status-styles";
import { CASE_PRIORITY_LABEL, CASE_STATUS_LABEL, STALE_DAYS, agoText, daysText, fechaCorta, type CaseSummary } from "@/lib/case-summary";
import { interventionTypeLabel } from "@/lib/intervention-types";
import type { InterventionRow } from "@/services/interventions";

// Resumen del expediente arriba de todo: estado, área, cuánto lleva abierto y
// la última intervención, para entender el caso de un vistazo.

const PRIORITY_CLASS: Record<string, string> = {
  URGENTE: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  ALTA: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  MEDIA: "bg-muted text-muted-foreground border-border/60",
  BAJA: "bg-muted text-muted-foreground border-border/60",
};

function Tile({
  label,
  icon: Icon,
  children,
  warn = false,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 space-y-1.5 ${
        warn ? "border-amber-500/40 bg-amber-500/10" : "border-border/60 bg-card"
      }`}
    >
      <p
        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
          warn ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {children}
    </div>
  );
}

export function CaseSummaryHeader({
  status,
  priority,
  areaName,
  areaLabel,
  areaUrl,
  createdAt,
  closedAt,
  summary,
  lastIntervention,
  pendingTo,
  person,
  assigneeName,
  assignmentControl,
}: {
  status: string;
  priority: string;
  areaName: string;
  areaLabel: string;
  areaUrl: string;
  createdAt: Date;
  closedAt: Date | null;
  summary: CaseSummary;
  lastIntervention: InterventionRow | null;
  /** Área a la que está derivado, mientras espera respuesta. */
  pendingTo: string | null;
  person: { name: string; dni: string | null; href: string } | null;
  /** Profesional a cargo (null si no tiene). */
  assigneeName: string | null;
  /** Botón para asignar, cambiar o tomar el expediente. */
  assignmentControl?: React.ReactNode;
}) {
  const statusStyle = getCaseStatusConfig(status);

  return (
    <section aria-label="Resumen del expediente" className="space-y-3">
      {person && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Titular:</span>
          <Link href={person.href} className="font-bold text-foreground hover:underline">
            {person.name}
          </Link>
          {person.dni && <span className="font-semibold text-muted-foreground">· DNI {person.dni}</span>}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Estado" icon={Clock}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`text-xs font-bold ${statusStyle.badgeClass}`}>
              {CASE_STATUS_LABEL[status] ?? status}
            </Badge>
            <Badge variant="outline" className={`text-[10px] font-bold ${PRIORITY_CLASS[priority] ?? PRIORITY_CLASS.MEDIA}`}>
              {CASE_PRIORITY_LABEL[priority] ?? priority}
            </Badge>
          </div>
          {pendingTo && <p className="text-xs text-muted-foreground">Esperando respuesta de {pendingTo}</p>}
        </Tile>

        <Tile label="A cargo" icon={Landmark}>
          <Link href={areaUrl} title={areaName} className="block truncate text-base font-bold text-foreground hover:underline">
            {areaLabel}
          </Link>
          {areaLabel !== areaName && <p className="truncate text-xs text-muted-foreground" title={areaName}>{areaName}</p>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <p className={`flex min-w-0 items-start gap-1 text-xs font-semibold ${assigneeName ? "text-foreground" : "text-muted-foreground"}`}>
              <UserCheck className="mt-px h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{assigneeName ? `Profesional: ${assigneeName}` : "Sin profesional a cargo"}</span>
            </p>
            {assignmentControl}
          </div>
        </Tile>

        <Tile label={summary.closed ? "Estuvo abierto" : "Abierto hace"} icon={CalendarClock}>
          <p className="text-base font-bold text-foreground">{daysText(summary.openDays)}</p>
          <p className="text-xs text-muted-foreground">
            {summary.closed && closedAt
              ? `Del ${fechaCorta(createdAt)} al ${fechaCorta(closedAt)}`
              : `Desde el ${fechaCorta(createdAt)}`}
          </p>
        </Tile>

        <Tile label="Última intervención" icon={summary.stale ? AlertTriangle : MessageSquareText} warn={summary.stale}>
          {lastIntervention && summary.lastInterventionDays !== null ? (
            <>
              <p className={`text-base font-bold ${summary.stale ? "text-amber-800 dark:text-amber-200" : "text-foreground"}`}>
                {agoText(summary.lastInterventionDays)}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {[fechaCorta(new Date(lastIntervention.date)), interventionTypeLabel(lastIntervention.type), lastIntervention.author]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </>
          ) : (
            <p className={`text-base font-bold ${summary.stale ? "text-amber-800 dark:text-amber-200" : "text-foreground"}`}>
              Ninguna todavía
            </p>
          )}
          {summary.stale && (
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Sin movimiento hace {STALE_DAYS} días o más
            </p>
          )}
        </Tile>
      </div>
    </section>
  );
}
