"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Option = { id: string; name: string; area: string | null };

/** Elegir a las personas del equipo que salen a la recorrida (con buscador si son muchas). */
export function EquipoPicker({
  options,
  value,
  onChange,
  idPrefix,
}: {
  options: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
  idPrefix: string;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? options.filter((o) => `${o.name} ${o.area ?? ""}`.toLowerCase().includes(t)) : options;
    // Los elegidos, primero.
    return [...list].sort((a, b) => Number(value.includes(b.id)) - Number(value.includes(a.id)));
  }, [options, q, value]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      {options.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o área" className="h-10 rounded-xl pl-9" aria-label="Buscar en el equipo" />
        </div>
      )}
      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1.5">
        {shown.map((o) => (
          <li key={o.id}>
            <label htmlFor={`${idPrefix}-${o.id}`} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50">
              <input id={`${idPrefix}-${o.id}`} type="checkbox" className="h-4 w-4 accent-primary" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
              <span className="min-w-0 text-sm">
                <span className="font-semibold text-foreground">{o.name}</span>
                {o.area && <span className="text-muted-foreground"> · {o.area}</span>}
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">Nadie coincide con esa búsqueda.</li>}
      </ul>
      <p className="text-xs text-muted-foreground">{value.length === 1 ? "1 persona elegida" : `${value.length} personas elegidas`}</p>
    </div>
  );
}
