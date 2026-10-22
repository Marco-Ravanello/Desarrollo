import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ícono de lucide-react que acompaña al título. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Etiqueta corta junto al título (se oculta en celulares). */
  badge?: React.ReactNode;
  /** Botones o menús que van a la derecha del título. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Encabezado común de todas las pantallas: mismo tamaño de título,
 * descripción y lugar para los botones.
 */
export function PageHeader({ title, description, icon: Icon, badge, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-primary/20 dark:text-blue-300 sm:flex">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
              {title}
            </h1>
            {badge && (
              <span className="hidden items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300 sm:inline-flex">
                {badge}
              </span>
            )}
          </div>
          {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
