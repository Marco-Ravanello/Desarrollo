import * as React from "react";
import { Check, Inbox, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyKind = "empty" | "search" | "done";

interface EmptyMessageProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** El paso siguiente: un botón o un enlace. */
  action?: React.ReactNode;
  /**
   * "empty": todavía no hay nada cargado. "search": hay datos, pero no con estos filtros.
   * "done": no queda nada pendiente (buena noticia).
   */
  kind?: EmptyKind;
  /** Más bajo, para listas chicas dentro de una tarjeta. */
  compact?: boolean;
  className?: string;
}

/** Dibujo simple: una hoja con el ícono, rodeada de puntos en los colores de la Muni. */
function EmptyIllustration({ kind, icon: Icon, compact }: { kind: EmptyKind; icon: React.ComponentType<{ className?: string }>; compact?: boolean }) {
  const Glyph = kind === "search" ? Search : kind === "done" ? Check : Icon;
  const tone =
    kind === "done"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-primary dark:text-primary";
  return (
    <div className={cn("relative shrink-0", compact ? "h-16 w-24" : "h-24 w-36")} aria-hidden>
      <svg viewBox="0 0 144 96" className="absolute inset-0 h-full w-full">
        <ellipse cx="72" cy="52" rx="58" ry="38" className={kind === "done" ? "fill-emerald-500/10" : "fill-primary/[0.07] dark:fill-primary/15"} />
        <ellipse cx="72" cy="86" rx="34" ry="4" className="fill-foreground/[0.06]" />
        {/* Hoja de atrás y hoja de adelante */}
        <rect x="52" y="16" width="44" height="60" rx="7" transform="rotate(-8 74 46)" className="fill-background stroke-border" strokeWidth="1.5" />
        <rect x="48" y="12" width="46" height="64" rx="7" className="fill-background stroke-border" strokeWidth="1.5" />
        <rect x="56" y="62" width="30" height="3.5" rx="1.75" className="fill-muted-foreground/20" />
        <rect x="56" y="68" width="20" height="3.5" rx="1.75" className="fill-muted-foreground/15" />
        {/* Puntitos de color */}
        <circle cx="26" cy="30" r="3" className="fill-accent" />
        <circle cx="118" cy="24" r="2.5" className={kind === "done" ? "fill-emerald-500/70" : "fill-primary/50"} />
        <circle cx="114" cy="70" r="3.5" className="fill-accent/40" />
        <path d="M30 66v6M27 69h6" className="stroke-primary/40" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M108 44v5M105.5 46.5h5" className="stroke-accent/70" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div
        className={cn(
          "absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border",
          compact ? "top-[17%] h-7 w-7" : "top-[19%] h-10 w-10",
          tone
        )}
      >
        <Glyph className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
      </div>
    </div>
  );
}

/** Mensaje de "no hay datos", con un dibujo y, si corresponde, el paso siguiente. */
export function EmptyMessage({ title, description, icon = Inbox, action, kind = "empty", compact = false, className }: EmptyMessageProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 px-4 py-6" : "gap-2 px-4 py-10",
        className
      )}
    >
      <EmptyIllustration kind={kind} icon={icon} compact={compact} />
      <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
