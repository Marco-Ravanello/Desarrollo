"use client";

import { useRouter } from "next/navigation";

/** Para la conducción: elegir de qué área ver la carga del equipo. */
export function TeamAreaSelect({ areaId, areas }: { areaId: string; areas: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="Área"
      value={areaId}
      onChange={(e) => router.push(`/cases/equipo?area=${e.target.value}`)}
      className="h-10 rounded-xl border border-border/60 bg-card px-3 text-sm font-semibold text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {areas.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
