import * as React from "react";
import { cn } from "@/lib/utils";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/status-tones";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** El puntito de color adelante del texto (por defecto, sí). */
  dot?: boolean;
  /** Un ícono en lugar del puntito. */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Insignia de estado: misma forma, mismo tamaño y colores con significado fijo
 * en toda la app (ver lib/status-tones.ts).
 */
export function StatusBadge({ tone, dot = true, icon: Icon, className, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold leading-none",
        STATUS_TONE_CLASS[tone],
        className
      )}
      {...props}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        dot && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}
