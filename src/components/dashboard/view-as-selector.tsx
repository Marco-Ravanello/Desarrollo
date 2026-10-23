"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

export interface ViewAsOption {
  value: string;
  label: string;
  /** Este inicio depende de un área (Dirección de Área, Operativo…). */
  needsArea: boolean;
}

/**
 * Solo para Superadmin: ver el inicio como lo ve cada rol, para revisarlo sin cambiar de usuario.
 * Los números salen de la base igual que para ese rol; lo personal (tareas, expedientes a cargo) es tuyo.
 */
export function ViewAsSelector({
  options,
  areas,
  current,
  currentArea,
}: {
  options: ViewAsOption[];
  areas: { id: string; name: string }[];
  current: string;
  currentArea: string | null;
}) {
  const router = useRouter();
  const go = (como: string, area: string | null) => {
    const sp = new URLSearchParams();
    if (como) sp.set("como", como);
    if (como && area && options.find((o) => o.value === como)?.needsArea) sp.set("area", area);
    const qs = sp.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  };
  const needsArea = options.find((o) => o.value === current)?.needsArea ?? false;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs">
      <Eye className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="ver-como" className="font-medium text-muted-foreground">
        Ver el inicio como
      </label>
      <select
        id="ver-como"
        value={current}
        onChange={(e) => go(e.target.value, currentArea)}
        className="h-8 rounded-lg border border-border/60 bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Superadmin (tu inicio)</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {needsArea && (
        <select
          aria-label="Área"
          value={currentArea ?? ""}
          onChange={(e) => go(current, e.target.value)}
          className="h-8 max-w-full rounded-lg border border-border/60 bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
