"use client";

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
  const go = (como: string, area: string | null) => {
    const sp = new URLSearchParams();
    if (como) sp.set("como", como);
    if (como && area && options.find((o) => o.value === como)?.needsArea) sp.set("area", area);
    const qs = sp.toString();
    // Carga completa a propósito: con una navegación interna los mapas del inicio se vuelven a
    // armar sobre el mapa anterior y la pantalla falla ("Map container is being reused").
    window.location.assign(qs ? `/dashboard?${qs}` : "/dashboard");
  };
  const needsArea = options.find((o) => o.value === current)?.needsArea ?? false;

  const selectClass =
    "h-7 max-w-[11rem] truncate rounded-md border-0 bg-transparent pl-1 text-xs font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  // Chico, en el encabezado: un ojo y el rol elegido. Activo, se marca en azul claro.
  return (
    <div
      className={`inline-flex h-9 items-center gap-1 rounded-xl border px-2 text-xs ${
        current ? "border-[#163C68]/30 bg-[#E0EEFF] dark:border-white/20 dark:bg-white/10" : "border-border/60 bg-card"
      }`}
      title="Ver el inicio como lo ve cada rol"
    >
      <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <select
        id="ver-como"
        aria-label="Ver el inicio como"
        value={current}
        onChange={(e) => go(e.target.value, currentArea)}
        className={selectClass}
      >
        <option value="">Ver como…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {needsArea && (
        <select
          aria-label="Área"
          value={currentArea ?? ""}
          onChange={(e) => go(current, e.target.value)}
          className={`${selectClass} border-l border-border/60 rounded-none pl-2`}
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
