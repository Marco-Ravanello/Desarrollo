"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Combine, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isProvisionalDni } from "@/lib/case-summary";
import { movedSummary, namesLookDifferent, recommendedKeep, type MergeCandidate, type MergeSide } from "@/lib/person-merge";
import {
  mergePeopleAction,
  previewMergeAction,
  searchMergeCandidatesAction,
} from "@/app/(dashboard)/people/actions/padron-duplicates-actions";

const dniLabel = (dni: string) => (isProvisionalDni(dni) ? "Sin DNI (provisorio)" : `DNI ${dni}`);

/**
 * "Unir con otra ficha": para cuando la misma persona quedó cargada dos veces. Se busca la otra ficha, se
 * comparan las dos y se elige cuál queda. Solo la conducción (lo controla también el servidor).
 */
export function MergePersonDialog({ dni, triggerClassName }: { dni: string; triggerClassName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<MergeCandidate[] | null>(null);
  const [preview, setPreview] = useState<{ a: MergeSide; b: MergeSide } | null>(null);
  const [keep, setKeep] = useState<string>(dni);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [merging, setMerging] = useState(false);
  const searchSeq = useRef(0);

  // Al abrir: las fichas con el mismo nombre. Al escribir: las que coinciden por DNI o nombre.
  useEffect(() => {
    if (!open || preview) return;
    const seq = ++searchSeq.current;
    const t = setTimeout(
      () => {
        searchMergeCandidatesAction(dni, query)
          .then((rows) => seq === searchSeq.current && setCandidates(rows))
          .catch(() => seq === searchSeq.current && setCandidates([]));
      },
      query ? 300 : 0
    );
    return () => clearTimeout(t);
  }, [open, query, dni, preview]);

  function reset() {
    setQuery("");
    setCandidates(null);
    setPreview(null);
    setError(null);
    setKeep(dni);
  }

  function choose(otherDni: string) {
    setError(null);
    start(async () => {
      const res = await previewMergeAction(dni, otherDni);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setPreview({ a: res.a, b: res.b });
      setKeep(recommendedKeep(res.a, res.b));
    });
  }

  async function merge() {
    if (!preview) return;
    const remove = keep === preview.a.dni ? preview.b.dni : preview.a.dni;
    setMerging(true);
    const res = await mergePeopleAction(keep, remove);
    setMerging(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Listo, las dos fichas quedaron en una sola.");
    setOpen(false);
    reset();
    if (keep === dni) router.refresh();
    else router.push(`/people/${encodeURIComponent(keep)}`);
  }

  const removeSide = preview ? (keep === preview.a.dni ? preview.b : preview.a) : null;
  const typedDni = query.replace(/[^0-9A-Za-z-]/g, "");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={triggerClassName}>
          <Combine className="h-3.5 w-3.5" aria-hidden /> Unir con otra ficha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border/60 bg-card p-6 shadow-2xl sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Unir con otra ficha</DialogTitle>
          <DialogDescription>
            Para cuando la misma persona quedó cargada dos veces (por ejemplo, una vez sin DNI o con el DNI mal escrito). Todo lo de las dos fichas queda en
            una sola.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="merge-search">Buscar la otra ficha</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="merge-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="DNI o apellido y nombre"
                  className="rounded-xl pl-9"
                  autoComplete="off"
                />
              </div>
            </div>
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            {candidates === null ? (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando fichas parecidas…
              </p>
            ) : candidates.length === 0 ? (
              <div className="space-y-2 py-1 text-sm text-muted-foreground">
                <p>{query ? "No encontré otra ficha con eso." : "No hay otras fichas con el mismo nombre. Buscala por DNI o por apellido."}</p>
                {typedDni.length >= 6 && (
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={busy} onClick={() => choose(typedDni)}>
                    Comparar con el DNI {typedDni}
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
                {candidates.map((c) => (
                  <li key={c.dni}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => choose(c.dni)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">{c.nombre || "Sin nombre"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {dniLabel(c.dni)}
                          {c.direccion ? ` · ${c.direccion}` : ""}
                        </span>
                      </span>
                      {c.sugerida && <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">Mismo nombre</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abriendo la comparación…
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {namesLookDifferent(preview.a.nombre, preview.b.nombre) && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Los nombres no se parecen. Revisá que sea la misma persona antes de unir.
              </p>
            )}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-foreground">¿Cuál queda?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {[preview.a, preview.b].map((s) => (
                  <SideCard key={s.dni} side={s} selected={keep === s.dni} onSelect={() => setKeep(s.dni)} current={s.dni === dni} />
                ))}
              </div>
            </fieldset>
            {removeSide && (
              <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-foreground">
                Queda la ficha del <strong>{dniLabel(keep)}</strong>. La del <strong>{dniLabel(removeSide.dni)}</strong> se borra y le pasa{" "}
                {movedSummary(removeSide)}. Los datos que falten se completan con los de la otra; no se pisa nada. <strong>No se puede deshacer.</strong>
              </p>
            )}
          </div>
        )}

        {preview && (
          <DialogFooter className="gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="ghost" className="gap-1.5 rounded-xl font-bold" onClick={() => setPreview(null)} disabled={merging}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Elegir otra
            </Button>
            <Button type="button" className="gap-2 rounded-xl font-bold" onClick={merge} disabled={merging}>
              {merging ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Combine className="h-4 w-4" aria-hidden />}
              Unir las dos fichas
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SideCard({ side, selected, onSelect, current }: { side: MergeSide; selected: boolean; onSelect: () => void; current: boolean }) {
  const rows: [string, string][] = [
    ["Domicilio", side.direccion || "Sin dirección"],
    ["Teléfono", side.telefono || "Sin teléfono"],
    ["Nacimiento", side.nacimiento || "Sin dato"],
    ["Programas", side.programas.length ? side.programas.join(", ") : "Ninguno"],
    ["Tiene", movedSummary(side)],
  ];
  return (
    <label
      className={cn(
        "block cursor-pointer rounded-xl border p-3 text-sm transition-colors",
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border/60 hover:border-primary/40"
      )}
    >
      <span className="flex items-start gap-2">
        <input type="radio" name="merge-keep" className="mt-1 h-4 w-4 accent-[#163C68]" checked={selected} onChange={onSelect} />
        <span className="min-w-0">
          <span className="block font-semibold text-foreground [overflow-wrap:anywhere]">{side.nombre || "Sin nombre"}</span>
          <span className="block text-xs text-muted-foreground">
            {dniLabel(side.dni)}
            {current ? " · esta ficha" : ""}
            {!side.enPadron ? " · no está en el padrón" : ""}
          </span>
        </span>
      </span>
      <dl className="mt-2 space-y-1 pl-6">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-xs text-foreground [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
      <span className={cn("mt-2 block pl-6 text-xs font-semibold", selected ? "text-primary" : "text-muted-foreground")}>
        {selected ? "Queda esta" : "Se borra y pasa todo a la otra"}
      </span>
    </label>
  );
}
