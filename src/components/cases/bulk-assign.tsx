"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assignCasesAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { plural } from "@/lib/formato";

// Asignar varios expedientes juntos desde la lista: se tildan las filas y abajo aparece la barra
// para elegir quién queda a cargo. Solo se ofrece con un área elegida en los filtros.

type Ctx = { selected: Set<string>; toggle: (id: string) => void; setMany: (ids: string[], on: boolean) => void; clear: () => void };
const BulkCtx = createContext<Ctx | null>(null);

export function BulkAssignProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const value = useMemo<Ctx>(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((s) => {
          const n = new Set(s);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        }),
      setMany: (ids, on) =>
        setSelected((s) => {
          const n = new Set(s);
          ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
          return n;
        }),
      clear: () => setSelected(new Set()),
    }),
    [selected]
  );
  return <BulkCtx.Provider value={value}>{children}</BulkCtx.Provider>;
}

function useBulk() {
  return useContext(BulkCtx);
}

/** La casilla de una fila. Sin el proveedor (sin área elegida) no se muestra. */
export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  const bulk = useBulk();
  if (!bulk) return null;
  return (
    <input
      type="checkbox"
      checked={bulk.selected.has(id)}
      onChange={() => bulk.toggle(id)}
      aria-label={`Elegir ${label}`}
      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
    />
  );
}

/** La casilla del encabezado: elige o saca todos los de la página. */
export function BulkSelectAll({ ids }: { ids: string[] }) {
  const bulk = useBulk();
  if (!bulk || ids.length === 0) return null;
  const all = ids.every((id) => bulk.selected.has(id));
  const some = !all && ids.some((id) => bulk.selected.has(id));
  return (
    <input
      type="checkbox"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={() => bulk.setMany(ids, !all)}
      aria-label={all ? "Sacar todos los de esta página" : "Elegir todos los de esta página"}
      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
    />
  );
}

type Person = { id: string; name: string; open: number; away?: string | null };

/** La barra de abajo: cuántos están elegidos, a quién se asignan y el botón. */
export function BulkAssignBar({ people, areaLabel }: { people: Person[]; areaLabel: string }) {
  const bulk = useBulk();
  const router = useRouter();
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);
  if (!bulk || bulk.selected.size === 0) return null;
  const count = bulk.selected.size;

  const submit = async () => {
    const person = people.find((p) => p.id === assignee);
    if (!person) return toast.error("Elegí quién queda a cargo.");
    setSaving(true);
    const res = await assignCasesAction(Array.from(bulk.selected), person.id).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as { error?: string } | null)?.error || "No se pudo asignar. Probá de nuevo.");
    toast.success(
      `${person.name} quedó a cargo de ${plural(res.assigned, "expediente")}.` +
        (res.skipped ? ` ${plural(res.skipped, "no se pudo", "no se pudieron")} asignar (cerrados o sin permiso).` : " Le llega un aviso.")
    );
    bulk.clear();
    setAssignee("");
    router.refresh();
  };

  return (
    <div
      role="region"
      aria-label="Asignar los expedientes elegidos"
      className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(44rem,calc(100%-2rem))] flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-card px-4 py-3 shadow-xl"
    >
      <p className="text-sm font-bold text-foreground">
        {plural(count, "elegido", "elegidos")} <span className="font-normal text-muted-foreground">· {areaLabel}</span>
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select
          aria-label="Quién queda a cargo"
          value={assignee}
          disabled={saving}
          onChange={(e) => setAssignee(e.target.value)}
          className="h-9 max-w-[16rem] rounded-xl border border-border/60 bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Dejar a cargo de…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.open === 0 ? "ningún abierto" : plural(p.open, "abierto")}{p.away ? ` · ${p.away.toLowerCase()}` : ""}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={saving || !assignee} onClick={submit} className="h-9 gap-1.5 rounded-xl text-xs font-bold">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          Asignar
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={bulk.clear} className="h-9 gap-1 rounded-xl text-xs font-bold">
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
