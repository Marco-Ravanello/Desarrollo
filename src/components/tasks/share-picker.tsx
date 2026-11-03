"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InitialsAvatar } from "@/components/ui/initials-avatar";

export type ShareableUser = { id: string; name: string; areaName: string | null };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Con quién se comparte una tarea: los elegidos arriba (con una cruz para sacarlos) y un buscador por
 * nombre o área. Se usa al crear la tarea en la Agenda y al editarla en Mis tareas.
 */
export function SharePicker({
  users,
  value,
  onChange,
  inputId,
}: {
  users: ShareableUser[];
  value: string[];
  onChange: (ids: string[]) => void;
  inputId: string;
}) {
  const [search, setSearch] = useState("");
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const matches = useMemo(() => {
    const q = normal(search.trim());
    const list = q ? users.filter((u) => normal(`${u.name} ${u.areaName ?? ""}`).includes(q)) : users;
    return list.slice(0, 50);
  }, [search, users]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <li key={id} className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 py-0.5 pl-1 pr-1 text-xs font-medium">
              <InitialsAvatar name={byId.get(id)?.name ?? "?"} seed={id} size="xs" />
              {byId.get(id)?.name ?? "Usuario dado de baja"}
              <button type="button" onClick={() => toggle(id)} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
                <span className="sr-only">Dejar de compartir con {byId.get(id)?.name ?? "este usuario"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Solo la ves vos.</p>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o área"
          autoComplete="off"
          className="rounded-xl pl-9"
        />
      </div>
      <ul className="max-h-44 divide-y divide-border/30 overflow-y-auto rounded-xl border border-border/50">
        {matches.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">Nadie coincide con la búsqueda.</li>
        ) : (
          matches.map((u) => (
            <li key={u.id}>
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/30">
                <input type="checkbox" checked={value.includes(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 accent-primary" />
                <InitialsAvatar name={u.name} seed={u.id} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{u.name}</span>
                  {u.areaName && <span className="block truncate text-xs text-muted-foreground">{u.areaName}</span>}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
