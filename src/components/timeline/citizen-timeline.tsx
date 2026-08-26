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
      {events.map((event) => (
        <div key={event.id} className="relative flex items-start gap-6 group">
          <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background shadow-xs transition-all group-hover:scale-110 z-10 ${
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

          <div className="flex-1 space-y-1.5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <h4 className="font-black text-foreground leading-none text-sm">{event.title}</h4>
                 {event.area && (
                    <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4 border-border text-foreground">
                        {event.area}
                    </Badge>
                 )}
              </div>
              <time className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {new Date(event.date).toLocaleDateString('es-AR')}
              </time>
            </div>
            {event.description && (
               <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-2xl border border-border/40 leading-relaxed font-medium">
                  {event.description}
               </p>
            )}
          </div>
        </div>
      ))}
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
