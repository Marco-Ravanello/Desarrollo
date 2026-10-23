import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lista compacta para celulares: una fila por elemento, que se toca entera para entrar.
 * Va junto a la tabla de la compu (la tabla se oculta en celulares con `hidden md:block`).
 */
export function MobileList({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <ul aria-label={label} className={cn("md:hidden divide-y divide-border/50", className)}>
      {children}
    </ul>
  );
}

interface MobileListItemProps {
  href?: string;
  /** Renglón principal (nombre o carátula). */
  title: React.ReactNode;
  /** Segundo renglón (DNI, barrio, área…). */
  subtitle?: React.ReactNode;
  /** Tercer renglón opcional, más tenue. */
  meta?: React.ReactNode;
  /** A la derecha: estado o fecha. */
  aside?: React.ReactNode;
  className?: string;
}

export function MobileListItem({ href, title, subtitle, meta, aside, className }: MobileListItemProps) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        {meta && <div className="mt-0.5 truncate text-xs text-muted-foreground/80">{meta}</div>}
      </div>
      {aside && <div className="flex shrink-0 flex-col items-end gap-1 text-right">{aside}</div>}
      {href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />}
    </>
  );
  return (
    <li className={className}>
      {href ? (
        <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors active:bg-muted/40">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{body}</div>
      )}
    </li>
  );
}

/**
 * Fila de indicadores: en celulares, una sola fila que se corre de costado;
 * desde tablet, la grilla de siempre.
 */
export function StatRow({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4",
        "[&>*]:min-w-[9.5rem] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
}
