"use client";

import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, CheckCircle2, History, Package } from "lucide-react";

interface TimelineEvent {
  id: string;
  type: 'INTERVENTION' | 'CASE_CREATED' | 'CASE_CLOSED' | 'DOCUMENT';
  date: string;
  title: string;
  description?: string;
  area?: string;
}

interface StructuredDetail {
  label: string;
  value: string;
}

function parseEventDescription(description?: string): { type: 'structured'; items: StructuredDetail[] } | { type: 'text'; text: string } | null {
  if (!description) return null;
  if (description.includes('|')) {
    const parts = description.split('|').map(p => p.trim()).filter(Boolean);
    const items: StructuredDetail[] = [];
    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx !== -1) {
        items.push({
          label: part.substring(0, colonIdx).trim(),
          value: part.substring(colonIdx + 1).trim()
        });
      } else {
        items.push({
          label: 'Detalle',
          value: part
        });
      }
    }
    if (items.length > 0) {
      return { type: 'structured', items };
    }
  }
  return { type: 'text', text: description };
}

function formatTimelineDate(dateStr: string) {
  if (!dateStr || dateStr === "S/F") return "Fecha no especificada";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function CitizenTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-border/60 rounded-3xl bg-muted/20">
        <History className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-xs font-bold">No hay eventos registrados en la línea de tiempo.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/60 before:to-transparent">
      {events.map((event) => {
        const parsedDesc = parseEventDescription(event.description);

        const isDuplicateArea =
          !event.area ||
          event.title.toLowerCase().trim() === event.area.toLowerCase().trim() ||
          event.title.toLowerCase().includes(event.area.toLowerCase());
        const showAreaBadge = Boolean(event.area && !isDuplicateArea);

        return (
          <div key={event.id} className="relative flex items-start gap-4 sm:gap-6 group">
            <div className={`mt-0.5 flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border-4 border-background shadow-xs transition-all group-hover:scale-105 z-10 ${
              event.type === 'INTERVENTION' ? 'bg-blue-500/15 text-blue-500' :
              event.type === 'CASE_CREATED' ? 'bg-emerald-500/15 text-emerald-500' :
              event.type === 'CASE_CLOSED' ? 'bg-muted text-muted-foreground' :
              'bg-amber-500/15 text-amber-500'
            }`}>
               {event.type === 'INTERVENTION' && <ActivityIcon className="h-4 w-4" />}
               {event.type === 'CASE_CREATED' && <FileText className="h-4 w-4" />}
               {event.type === 'CASE_CLOSED' && <CheckCircle2 className="h-4 w-4" />}
               {event.type === 'DOCUMENT' && <Package className="h-4 w-4" />}
            </div>

            <div className="flex-1 min-w-0 space-y-2 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                   <h4 className="font-bold text-foreground text-sm leading-snug">
                     {event.title}
                   </h4>
                   {showAreaBadge && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border-border/70 bg-muted/40 text-muted-foreground shrink-0 leading-normal"
                        title={event.area}
                      >
                          {event.area}
                      </Badge>
                   )}
                </div>
                <time className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                  <Calendar className="h-3 w-3 text-muted-foreground/70" />
                  {formatTimelineDate(event.date)}
                </time>
              </div>

              {parsedDesc && (
                <div className="mt-2.5">
                  {parsedDesc.type === 'structured' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {parsedDesc.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col justify-between p-2.5 px-3 rounded-xl bg-muted/20 border border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                            {item.label}
                          </span>
                          <span className="text-xs font-semibold text-foreground mt-1 break-words leading-snug">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-xl border border-border/50 leading-relaxed font-medium">
                      {parsedDesc.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
