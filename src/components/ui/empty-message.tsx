import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyMessageProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

/** Mensaje de "no hay datos" compacto, para tablas, listas y tarjetas. */
export function EmptyMessage({ title, description, icon: Icon = Inbox, action, className }: EmptyMessageProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-10 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
