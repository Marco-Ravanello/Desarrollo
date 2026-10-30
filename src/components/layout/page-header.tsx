import * as React from "react";
import { cn } from "@/lib/utils";
import { PageHeaderIcon } from "./page-header-icon";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ícono de lucide-react que acompaña al título. */
  icon?: React.ComponentType<{ className?: string }>;
  /** En lugar del ícono (por ejemplo, las iniciales de la persona). */
  leading?: React.ReactNode;
  /** Junto al título: un texto corto (etiqueta naranja, se oculta en celulares) o una insignia de estado. */
  badge?: React.ReactNode;
  /** Botones o menús que van a la derecha del título. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Encabezado común de todas las pantallas: ícono con el color de su sección del menú,
 * mismo tamaño de título, descripción y lugar para los botones.
 */
export function PageHeader({ title, description, icon: Icon, leading, badge, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        {leading ? (
          <div className="hidden shrink-0 sm:flex">{leading}</div>
        ) : Icon && (
          <PageHeaderIcon>
            <Icon className="h-5 w-5" />
          </PageHeaderIcon>
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
              {title}
            </h1>
            {typeof badge === "string" ? (
              <span className="hidden items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300 sm:inline-flex">
                {badge}
              </span>
            ) : (
              badge
            )}
          </div>
          {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
