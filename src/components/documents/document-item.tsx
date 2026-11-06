import { ExternalLink, FileText, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFechaCalendario } from "@/lib/fechas";
import { documentKindLabel, expiryState } from "@/lib/document-kinds";
import { DocumentExpiryButton } from "./document-expiry-button";

export type DocumentItemData = {
  id: string;
  name: string;
  url: string | null;
  kind: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
};

const EXPIRY_TONE = {
  vencido: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  "por-vencer": "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  vigente: "bg-muted text-muted-foreground",
} as const;

/** Un documento de la ficha o del expediente: tipo, cuándo vence (en ámbar o rojo si está cerca o vencido) y el archivo. */
export function DocumentItem({ doc, today, canEdit, highlight }: { doc: DocumentItemData; today: string; canEdit: boolean; highlight?: boolean }) {
  const href = doc.url ? (doc.url.startsWith("/api") ? doc.url : `/api${doc.url}`) : null;
  const expiry = doc.expiresAt ? new Date(doc.expiresAt).toISOString().slice(0, 10) : null;
  const state = expiry ? expiryState(expiry, today) : null;
  const kindLabel = doc.kind && doc.kind !== "OTRO" ? documentKindLabel(doc.kind) : null;
  return (
    <div
      id={`doc-${doc.id}`}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between",
        highlight && "ring-2 ring-primary/40"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {href ? <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {kindLabel && kindLabel !== doc.name ? <span className="font-semibold">{kindLabel} · </span> : null}
            {doc.name}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{href ? `Subido el ${formatFechaCalendario(doc.createdAt)}` : `Anotado el ${formatFechaCalendario(doc.createdAt)}, sin archivo`}</span>
            {state && <span className={cn("rounded-md px-1.5 py-0.5 font-semibold", EXPIRY_TONE[state.state])}>{state.label}</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
        {canEdit && <DocumentExpiryButton id={doc.id} name={doc.name} kind={doc.kind} expiresAt={expiry} />}
        {href && (
          <Button variant="ghost" size="sm" asChild className="font-bold text-primary">
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" aria-hidden /> Abrir
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
