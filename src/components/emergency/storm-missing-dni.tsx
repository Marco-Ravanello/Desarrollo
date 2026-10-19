"use client";

import { useState } from "react";
import { Contact, Loader2, Search, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StormVictimItem } from "@/types/emergency";
import { normalizeDni } from "@/lib/padron-import";
import { recordsWithoutDni } from "@/lib/emergency-categories";
import { completeStormRecordDniAction, lookupStormDniAction } from "@/app/(dashboard)/admin/actions/emergency-actions";

type Lookup = Awaited<ReturnType<typeof lookupStormDniAction>>;

function MissingDniRow({ record, onSaved }: { record: StormVictimItem; onSaved: () => void }) {
  const [dni, setDni] = useState("");
  const [lookup, setLookup] = useState<Lookup>(null);
  const [busy, setBusy] = useState(false);
  const clean = normalizeDni(dni);
  const checked = lookup?.dni === clean;

  const handleLookup = async () => {
    if (!clean) {
      toast.error("El DNI tiene que tener entre 6 y 8 números.");
      return;
    }
    setBusy(true);
    const res = await lookupStormDniAction(clean).catch(() => null);
    setBusy(false);
    if (!res) toast.error("No se pudo buscar el DNI. Probá de nuevo.");
    setLookup(res);
  };

  const handleSave = async () => {
    if (!clean || !record.id) return;
    setBusy(true);
    const res = await completeStormRecordDniAction(record.id, clean).catch(() => ({ success: false as const, error: "No se pudo guardar el DNI. Probá de nuevo." }));
    setBusy(false);
    if (res.success) {
      toast.success(res.message);
      onSaved();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <li className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-bold uppercase text-foreground">{record.nombreApellido}</p>
        <p className="text-xs text-muted-foreground">
          {[record.domicilio, record.barrio].filter(Boolean).join(" · ")}
          {record.createdAt ? ` · cargada el ${new Date(record.createdAt).toLocaleDateString("es-AR")}` : ""}
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleLookup();
        }}
      >
        <Input
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          inputMode="numeric"
          placeholder="DNI"
          aria-label={`DNI de ${record.nombreApellido}`}
          className="h-10 rounded-xl text-sm font-bold"
        />
        <Button type="submit" variant="outline" disabled={busy || !dni.trim()} className="h-10 rounded-xl shrink-0">
          {busy && !checked ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
        </Button>
      </form>

      {checked && lookup && (
        <div className="space-y-3">
          {lookup.padron ? (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-foreground">
                En el padrón con ese DNI está <b className="uppercase">{lookup.padron.nombre}</b>
                {lookup.padron.direccion ? ` (${lookup.padron.direccion})` : ""}. Si es la misma persona, se une la ficha con ella.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
              <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <p className="text-foreground">Ese DNI no está en el padrón: se suma con los datos de esta ficha.</p>
            </div>
          )}
          <Button type="button" onClick={handleSave} disabled={busy} className="w-full rounded-xl h-10 font-bold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Contact className="h-4 w-4" />}
            {lookup.padron ? "Es la misma persona: guardar DNI" : "Guardar DNI y sumar al padrón"}
          </Button>
        </div>
      )}
    </li>
  );
}

interface StormMissingDniProps {
  records: StormVictimItem[];
  onSaved: () => void;
}

/** Aviso con las fichas cargadas sin DNI y la lista para completarlo. */
export function StormMissingDni({ records, onSaved }: StormMissingDniProps) {
  const [open, setOpen] = useState(false);
  const missing = recordsWithoutDni(records);
  if (missing.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Contact className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-foreground">
            <span className="font-bold">
              {missing.length === 1 ? "1 ficha no tiene DNI." : `${missing.length} fichas no tienen DNI.`}
            </span>{" "}
            Completalo para unir a la persona con el padrón.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="shrink-0 rounded-xl">
          <Contact className="h-4 w-4" /> Completar DNI
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Fichas sin DNI ({missing.length})</DialogTitle>
            <DialogDescription>
              Escribí el DNI y tocá Buscar para ver si la persona ya está en el padrón. Al guardar, la ficha, el expediente y las
              intervenciones quedan a nombre de esa persona.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {missing.map((r) => (
              <MissingDniRow key={r.id} record={r} onSaved={onSaved} />
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
