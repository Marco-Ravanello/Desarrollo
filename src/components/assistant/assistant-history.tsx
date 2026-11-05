"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONVERSATION_RETENTION_DAYS, conversationDayLabel } from "@/lib/assistant-conversations";

export type ConversationItem = { id: string; title: string; updatedAt: string | Date };

/** Las conversaciones anteriores de la persona, agrupadas por día. Se usa al costado y, en el celular, en un panel. */
export function AssistantHistory({
  conversations,
  activeId,
  onOpen,
  onDelete,
  className,
}: {
  conversations: ConversationItem[] | null;
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (item: ConversationItem) => void;
  className?: string;
}) {
  const groups: { day: string; items: ConversationItem[] }[] = [];
  for (const c of conversations ?? []) {
    const day = conversationDayLabel(new Date(c.updatedAt));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(c);
    else groups.push({ day, items: [c] });
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {conversations === null ? (
          <div className="space-y-2 p-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Todavía no tenés conversaciones guardadas. Cada pregunta que hagas queda acá.</p>
        ) : (
          groups.map((g) => (
            <section key={g.day} className="mb-3">
              <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{g.day}</h3>
              <ul className="space-y-0.5">
                {g.items.map((c) => {
                  const active = c.id === activeId;
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onOpen(c.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg py-2 pl-2 pr-8 text-left text-sm transition-colors",
                          active ? "bg-primary/10 font-medium text-primary dark:text-blue-200" : "text-foreground/85 hover:bg-muted"
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
                        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-100 hover:bg-rose-500/10 hover:text-rose-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={`Borrar la conversación "${c.title}"`}
                        title="Borrar"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
      <p className="mt-2 border-t border-border/60 px-2 pt-2 text-xs leading-snug text-muted-foreground">
        Solo vos ves tus conversaciones. Se borran solas {CONVERSATION_RETENTION_DAYS} días después de la última pregunta.
      </p>
    </div>
  );
}
