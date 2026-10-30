import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Clase de los <select> de los formularios, igual en todas las pantallas. */
export const fieldSelectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

/** La marca de campo obligatorio. Es la misma en toda la app. */
export function RequiredMark() {
  return (
    <span className="ml-0.5 font-bold text-rose-600 dark:text-rose-400" aria-hidden>
      *
    </span>
  );
}

/** "Los campos con * son obligatorios.", para poner una vez por formulario. */
export function RequiredNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Los campos con <RequiredMark /> son obligatorios.
    </p>
  );
}

/** Etiqueta + campo + ayuda opcional. Con `required` muestra la marca de obligatorio. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
        {required && <RequiredMark />}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Un bloque de un formulario largo: título, explicación corta y sus campos.
 * `card` lo muestra como tarjeta (formularios de página); `plain` como bloque con una línea arriba (paneles laterales).
 */
export function FormSection({
  title,
  description,
  icon: Icon,
  variant = "card",
  actions,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  variant?: "card" | "plain";
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "min-w-0 space-y-4",
        variant === "card"
          ? "rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
          : "border-t border-border/60 pt-5 first:border-t-0 first:pt-0",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
