"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFecha } from "@/lib/fechas";
import { EquipoPicker } from "@/components/barrios/equipo-picker";
import { createRecorridaAction } from "@/app/(dashboard)/barrios/actions";
import type { RecorridaCandidate, UserOption } from "@/services/recorridas";
import { RequiredMark } from "@/components/ui/form-section";

/** La lista armada: se destilda a quien no haga falta visitar, se elige el día y el equipo, y se guarda. */
export function RecorridaBuilder({
  barrio,
  criteria,
  people,
  userOptions,
  defaultEquipo,
  today,
  backHref,
}: {
  backHref: string;
  barrio: string;
  criteria: string;
  people: RecorridaCandidate[];
  userOptions: UserOption[];
  defaultEquipo: string[];
  today: string;
}) {
  const router = useRouter();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [fecha, setFecha] = useState(today);
  const [objetivo, setObjetivo] = useState("");
  const [equipo, setEquipo] = useState<string[]>(defaultEquipo);
  const [saving, setSaving] = useState(false);
  const chosen = people.length - excluded.length;
  const toggle = (dni: string) => setExcluded((x) => (x.includes(dni) ? x.filter((d) => d !== dni) : [...x, dni]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosen) return toast.error("Dejá al menos una persona en la lista.");
    if (!fecha) return toast.error("Elegí el día de la recorrida.");
    setSaving(true);
    const res = await createRecorridaAction(barrio, criteria, excluded, { fecha, objetivo, equipoIds: equipo }).catch(() => null);
    if (!res?.success) {
      setSaving(false);
      return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    }
    toast.success("Recorrida guardada.");
    router.push(`/barrios/recorridas/${"id" in res ? res.id : ""}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          <span className="font-bold text-foreground tabular-nums">{chosen}</span> de {people.length} en la lista.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setExcluded([])}>Marcar todas</Button>
          <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setExcluded(people.map((p) => p.dni))}>Desmarcar todas</Button>
        </div>
      </div>

      <ol className="divide-y divide-border/40 rounded-2xl border border-border/60">
        {people.map((p, i) => {
          const on = !excluded.includes(p.dni);
          return (
            <li key={p.dni} className={on ? "" : "bg-muted/30"}>
              <label htmlFor={`incluir-${p.dni}`} className="flex cursor-pointer gap-3 p-3">
                <input id={`incluir-${p.dni}`} type="checkbox" checked={on} onChange={() => toggle(p.dni)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                <span className="w-6 shrink-0 pt-0.5 text-right text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className={`min-w-0 flex-1 ${on ? "" : "opacity-60"}`}>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-foreground">{p.nombre || "Sin nombre"}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">DNI {p.dni}</span>
                  </span>
                  <span className="block text-sm text-foreground">{p.direccion || <span className="italic text-muted-foreground">Sin dirección</span>}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {p.motivos.map((m) => (
                      <span key={m} className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{m}</span>
                    ))}
                    {p.ultimaVisita && (
                      <span className="rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">Visitada el {formatFecha(p.ultimaVisita)}</span>
                    )}
                  </span>
                </span>
                {p.telefono && <span className="hidden shrink-0 text-sm tabular-nums text-muted-foreground sm:block">{p.telefono}</span>}
              </label>
            </li>
          );
        })}
      </ol>

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
        <h3 className="font-heading text-base font-bold text-foreground">Guardar la recorrida</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="recorrida-fecha">Día <RequiredMark /></Label>
            <Input id="recorrida-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-10 rounded-xl" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recorrida-objetivo">Para qué se sale (opcional)</Label>
            <Input
              id="recorrida-objetivo"
              value={objetivo}
              maxLength={200}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Por ejemplo: seguimiento de expedientes quietos"
              className="h-10 rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Quiénes salen</Label>
          <EquipoPicker idPrefix="equipo-nueva" options={userOptions} value={equipo} onChange={setEquipo} />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild type="button" variant="outline" className="rounded-xl">
            <Link href={backHref}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving || !chosen} className="rounded-xl font-bold">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
            Guardar recorrida con {chosen === 1 ? "1 persona" : `${chosen} personas`}
          </Button>
        </div>
      </form>
    </div>
  );
}
