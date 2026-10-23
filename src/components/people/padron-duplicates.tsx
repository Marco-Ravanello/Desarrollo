"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Merge, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SIGNAL_LABELS } from "@/lib/padron-duplicates";
import { dismissPadronDuplicateAction, mergePadronDuplicatesAction } from "@/app/(dashboard)/people/actions/padron-duplicates-actions";
import type { DuplicatePair, DuplicatePerson } from "@/services/padron-duplicates";

function PersonColumn({ p, other }: { p: DuplicatePerson; other: DuplicatePerson }) {
  const differs = (a: unknown, b: unknown) => (a || "") !== (b || "");
  const row = (label: string, value: string | null, highlight: boolean) => (
    <div className="flex gap-2 text-xs">
      <span className="w-24 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words ${highlight ? "font-bold text-foreground" : "text-foreground"}`}>{value || "—"}</span>
    </div>
  );
  return (
    <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/20 p-3">
      <p className="text-sm font-bold text-foreground">DNI {p.dni}</p>
      {row("Nombre", p.nombre, differs(p.nombre, other.nombre))}
      {row("Domicilio", [p.direccion, p.barrio, p.localidad].filter(Boolean).join(" · ") || null, false)}
      {row("Nacimiento", p.fechaNacimiento, false)}
      {row("Teléfono", p.telefono, differs(p.telefono, other.telefono))}
      {row("Programas", p.programas.join(", ") || null, false)}
      {(p.expedientes > 0 || p.fichasTormenta > 0) &&
        row(
          "Expedientes",
          [p.expedientes && `${p.expedientes} expediente${p.expedientes === 1 ? "" : "s"}`, p.fichasTormenta && `${p.fichasTormenta} ficha${p.fichasTormenta === 1 ? "" : "s"} de tormenta`]
            .filter(Boolean)
            .join(", "),
          false
        )}
    </div>
  );
}

export function DuplicatePairCard({ pair }: { pair: DuplicatePair }) {
  const router = useRouter();
  const [keep, setKeep] = useState<DuplicatePerson | null>(null);
  const [busy, setBusy] = useState<"merge" | "dismiss" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const remove = keep ? (keep.dni === pair.a.dni ? pair.b : pair.a) : null;

  const merge = async () => {
    if (!keep || !remove) return;
    setBusy("merge");
    const res = await mergePadronDuplicatesAction(keep.dni, remove.dni).catch(() => null);
    setBusy(null);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudieron unir. Probá de nuevo.");
    toast.success(`Listo: quedó una sola persona con DNI ${keep.dni}.`);
    setKeep(null);
    setDone(`Unidas en el DNI ${keep.dni}.`);
    router.refresh();
  };

  const dismiss = async () => {
    setBusy("dismiss");
    const res = await dismissPadronDuplicateAction(pair.a.dni, pair.b.dni).catch(() => null);
    setBusy(null);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success("Listo: no vuelven a aparecer como duplicados.");
    setDone("Marcadas como personas distintas.");
    router.refresh();
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-foreground">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {pair.a.nombre}: {done}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-bold text-foreground">{pair.a.nombre}</p>
        {pair.signals.map((s) => (
          <Badge key={s} variant="outline" className="border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-700 dark:text-amber-300">
            {SIGNAL_LABELS[s]}
          </Badge>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PersonColumn p={pair.a} other={pair.b} />
        <PersonColumn p={pair.b} other={pair.a} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setKeep(pair.a)} disabled={busy !== null} className="gap-1.5 rounded-xl font-bold">
          <Merge className="h-3.5 w-3.5" /> Unir con DNI {pair.a.dni}
        </Button>
        <Button size="sm" onClick={() => setKeep(pair.b)} disabled={busy !== null} className="gap-1.5 rounded-xl font-bold">
          <Merge className="h-3.5 w-3.5" /> Unir con DNI {pair.b.dni}
        </Button>
        <Button size="sm" variant="outline" onClick={dismiss} disabled={busy !== null} className="gap-1.5 rounded-xl font-bold">
          {busy === "dismiss" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />} No son la misma persona
        </Button>
      </div>

      <Dialog open={keep !== null} onOpenChange={(open) => !open && busy === null && setKeep(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Unir en el DNI {keep?.dni}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Queda una sola persona, con DNI <b className="text-foreground">{keep?.dni}</b>. El registro con DNI{" "}
                  <b className="text-foreground">{remove?.dni}</b> se borra del padrón.
                </p>
                <p>
                  Sus programas, expedientes, intervenciones y fichas de tormenta pasan a la persona que queda. Los datos que le falten
                  se completan con los del otro registro; no se pisa nada.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setKeep(null)} disabled={busy !== null} className="rounded-xl font-bold">Cancelar</Button>
            <Button onClick={merge} disabled={busy !== null} className="gap-1.5 rounded-xl font-bold">
              {busy === "merge" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />} Unir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
