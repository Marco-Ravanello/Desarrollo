"use client";

import * as React from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * En celulares, los filtros quedan detrás de un botón "Filtros" que dice cuántos hay puestos.
 * Desde tablet se ven siempre. Lo que va adentro se manda en el mismo formulario.
 */
export function MobileFilters({ active, children, className }: { active: number; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="md:hidden flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 text-xs font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Filtros
          {active > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">{active}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div id={id} className={cn(open ? "contents" : "hidden", "md:contents", className)}>
        {children}
      </div>
    </>
  );
}
