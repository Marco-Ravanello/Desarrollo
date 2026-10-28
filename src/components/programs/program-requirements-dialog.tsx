"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BARRIOS_3F } from "@/lib/barrios";
import { CASE_LABELS } from "@/lib/case-labels";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";
import { REQUIREMENT_AGE_MAX, REQUIREMENT_NOTE_MAX, type ProgramRequirements } from "@/lib/program-requirements";
import { saveProgramRequirementsAction } from "@/app/(dashboard)/people/actions/program-requirements-actions";

/** Una opción que se prende y apaga, como pastilla. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** "Cargar requisitos" / "Cambiar requisitos" de un programa (lo ve quien da altas en él). */
export function ProgramRequirementsDialog({
  column,
  label,
  current,
}: {
  column: string;
  label: string;
  current: ProgramRequirements;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edadMin, setEdadMin] = useState("");
  const [edadMax, setEdadMax] = useState("");
  const [barrios, setBarrios] = useState<string[]>([]);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [enProgramas, setEnProgramas] = useState<string[]>([]);
  const [sinProgramas, setSinProgramas] = useState<string[]>([]);
  const [nota, setNota] = useState("");

  const reset = () => {
    setEdadMin(current.edadMin?.toString() ?? "");
    setEdadMax(current.edadMax?.toString() ?? "");
    setBarrios(current.barrios);
    setEtiquetas(current.etiquetas);
    setEnProgramas(current.enProgramas);
    setSinProgramas(current.sinProgramas);
    setNota(current.nota ?? "");
  };

  const others = PADRON_PROGRAMS.filter((p) => p.column !== column);
  const hasAny =
    current.edadMin !== null || current.edadMax !== null || current.barrios.length > 0 || current.etiquetas.length > 0 ||
    current.enProgramas.length > 0 || current.sinProgramas.length > 0 || Boolean(current.nota);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveProgramRequirementsAction(column, { edadMin, edadMax, barrios, etiquetas, enProgramas, sinProgramas, nota }).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success("Requisitos guardados.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={hasAny ? "outline" : "default"} size="sm" className="rounded-xl font-bold gap-1.5">
          <ListChecks className="h-4 w-4" /> {hasAny ? "Cambiar requisitos" : "Cargar requisitos"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Requisitos de {label}</DialogTitle>
            <DialogDescription>
              Con estos requisitos la app arma la lista de personas del padrón que los cumplen y todavía no están en el programa.
              Lo que no elijas no se tiene en cuenta.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-foreground">Edad</legend>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Label htmlFor="req-edad-min" className="font-normal">Desde</Label>
              <Input id="req-edad-min" type="number" inputMode="numeric" min={0} max={REQUIREMENT_AGE_MAX} value={edadMin} onChange={(e) => setEdadMin(e.target.value)} className="h-9 w-20 rounded-xl" />
              <Label htmlFor="req-edad-max" className="font-normal">hasta</Label>
              <Input id="req-edad-max" type="number" inputMode="numeric" min={0} max={REQUIREMENT_AGE_MAX} value={edadMax} onChange={(e) => setEdadMax(e.target.value)} className="h-9 w-20 rounded-xl" />
              <span className="text-muted-foreground">años</span>
            </div>
            <p className="text-xs text-muted-foreground">Sale de la fecha de nacimiento o de la edad cargada. A quien no tiene ninguna no se lo puede revisar por edad.</p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-foreground">Barrio</legend>
            <div className="flex flex-wrap gap-1.5">
              {BARRIOS_3F.map((b) => (
                <Chip key={b} on={barrios.includes(b)} onClick={() => setBarrios(toggle(barrios, b))}>{b}</Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-foreground">Que tenga un expediente abierto de</legend>
            <div className="flex flex-wrap gap-1.5">
              {CASE_LABELS.map((l) => (
                <Chip key={l.key} on={etiquetas.includes(l.key)} onClick={() => setEtiquetas(toggle(etiquetas, l.key))}>{l.label}</Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-foreground">Que esté en alguno de estos programas</legend>
            <div className="flex flex-wrap gap-1.5">
              {others.map((p) => (
                <Chip
                  key={p.column}
                  on={enProgramas.includes(p.column)}
                  onClick={() => {
                    setEnProgramas(toggle(enProgramas, p.column));
                    setSinProgramas(sinProgramas.filter((c) => c !== p.column));
                  }}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-foreground">Que no esté en ninguno de estos</legend>
            <div className="flex flex-wrap gap-1.5">
              {others.map((p) => (
                <Chip
                  key={p.column}
                  on={sinProgramas.includes(p.column)}
                  onClick={() => {
                    setSinProgramas(toggle(sinProgramas, p.column));
                    setEnProgramas(enProgramas.filter((c) => c !== p.column));
                  }}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="req-nota" className="font-bold">Otros requisitos (opcional)</Label>
            <Textarea
              id="req-nota"
              value={nota}
              maxLength={REQUIREMENT_NOTE_MAX}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Lo que la app no puede revisar sola. Por ejemplo: ingresos del hogar o documentación."
              className="rounded-xl"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
