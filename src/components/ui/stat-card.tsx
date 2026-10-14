import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  red: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  slate: "bg-muted text-muted-foreground",
} as const;

export type StatTone = keyof typeof tones;

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Texto chico debajo del número. */
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  className?: string;
}

/** Tarjeta de indicador (número grande con su etiqueta), igual en todas las pantallas. */
export function StatCard({ label, value, hint, icon: Icon, tone = "blue", className }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        {Icon && (
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
