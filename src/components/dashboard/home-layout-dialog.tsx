"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, LayoutGrid, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveHomeLayoutAction } from "@/app/(dashboard)/dashboard/actions";
import type { HomeSectionId } from "@/lib/home-layout";
import { cn } from "@/lib/utils";

interface Row {
  id: HomeSectionId;
  label: string;
  visible: boolean;
}

/**
 * "Ordenar tarjetas": cada persona sube, baja o esconde las tarjetas de su Inicio.
 * Solo las que ya le tocan por su rol; la grilla y los números de arriba no cambian.
 */
export function HomeLayoutDialog({ rows: initialRows, customized }: { rows: Row[]; customized: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  const reset = (next: boolean) => {
    setOpen(next);
    if (next) setRows(initialRows);
  };

  const move = (i: number, delta: -1 | 1) => {
    setRows((current) => {
      const j = i + delta;
      if (j < 0 || j >= current.length) return current;
      const next = [...current];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const toggle = (id: HomeSectionId, visible: boolean) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, visible } : r)));

  const save = (value: { order: HomeSectionId[]; hidden: HomeSectionId[] } | null, done: string) => {
    startTransition(async () => {
      const res = await saveHomeLayoutAction(value);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(done);
      setOpen(false);
      router.refresh();
    });
  };

  const visibleCount = rows.filter((r) => r.visible).length;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        {/* En pantallas chicas va solo el ícono, para no amontonar el encabezado del Inicio. */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-xl px-2.5 2xl:px-3"
          title="Ordenar las tarjetas del Inicio"
          aria-label="Ordenar tarjetas"
        >
          <LayoutGrid className="h-4 w-4" /> <span className="hidden 2xl:inline">Ordenar tarjetas</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ordenar las tarjetas del Inicio</DialogTitle>
          <DialogDescription>
            Subí o bajá cada tarjeta, o destildala para esconderla. Son las que te tocan por tu rol; los números de arriba quedan igual.
          </DialogDescription>
        </DialogHeader>

        <ol className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2",
                !r.visible && "bg-muted/40 text-muted-foreground"
              )}
            >
              <Checkbox
                id={`tarjeta-${r.id}`}
                checked={r.visible}
                onCheckedChange={(v) => toggle(r.id, v)}
                aria-label={r.visible ? `Esconder ${r.label}` : `Mostrar ${r.label}`}
              />
              <label htmlFor={`tarjeta-${r.id}`} className={cn("min-w-0 flex-1 cursor-pointer truncate text-sm font-medium", !r.visible && "line-through")}>
                {r.label}
              </label>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${r.label}`}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar ${r.label}`}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {visibleCount === 0 && (
          <p role="status" className="text-xs text-muted-foreground">Escondiste todas las tarjetas: en el Inicio van a quedar solo los números de arriba.</p>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={pending || !customized}
            onClick={() => save(null, "Volviste al orden original del Inicio.")}
            title={customized ? undefined : "Tu Inicio ya está en el orden original"}
          >
            <RotateCcw className="h-4 w-4" /> Volver al orden original
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                save(
                  { order: rows.map((r) => r.id), hidden: rows.filter((r) => !r.visible).map((r) => r.id) },
                  "Listo, guardamos el orden de tu Inicio."
                )
              }
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
