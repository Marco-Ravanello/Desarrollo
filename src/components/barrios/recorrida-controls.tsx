"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { formatFechaHora } from "@/lib/fechas";
import { VISITA_RESULTADOS, visitaResultadoLabel } from "@/lib/recorridas";
import { EquipoPicker } from "@/components/barrios/equipo-picker";
import {
  addVisitaAction, deleteRecorridaAction, saveVisitaAction, terminarRecorridaAction, updateRecorridaAction,
} from "@/app/(dashboard)/barrios/actions";
import type { RecorridaVisitaView, UserOption } from "@/services/recorridas";
import { RequiredMark } from "@/components/ui/form-section";

const RESULT_STYLE: Record<string, string> = {
  PENDIENTE: "border-border/60 bg-muted/40 text-muted-foreground",
  VISITADA: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  NO_ESTABA: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  NO_QUISO: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  SE_MUDO: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  OTRO: "border-border/60 bg-muted/40 text-foreground",
};

export function ResultadoBadge({ resultado }: { resultado: string }) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-bold ${RESULT_STYLE[resultado] ?? RESULT_STYLE.OTRO}`}>
      {visitaResultadoLabel(resultado)}
    </span>
  );
}

/** Una casa de la lista: quién vive, por qué se la visita y qué pasó (se anota desde el celular en la recorrida). */
export function VisitaItem({ recorridaId, visita, canMark }: { recorridaId: string; visita: RecorridaVisitaView; canMark: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [resultado, setResultado] = useState(visita.resultado === "PENDIENTE" ? "VISITADA" : visita.resultado);
  const [nota, setNota] = useState(visita.nota ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await saveVisitaAction(recorridaId, visita.id, resultado, nota).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    setEditing(false);
    router.refresh();
  };

  return (
    <li className="flex gap-3 p-3 sm:p-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${visita.resultado === "VISITADA" ? "bg-emerald-700" : visita.resultado === "PENDIENTE" ? "bg-[#163C68]" : visita.resultado === "SE_MUDO" ? "bg-rose-700" : "bg-amber-600"}`}
        aria-label={`Parada ${visita.orden}`}
      >
        {visita.orden}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <a href={`/people/${visita.dni}`} className="font-semibold text-foreground hover:text-primary hover:underline">{visita.nombre || "Sin nombre"}</a>
            <span className="ml-2 text-xs tabular-nums text-muted-foreground">DNI {visita.dni}</span>
            <p className="text-sm text-foreground">{visita.direccion || <span className="italic text-muted-foreground">Sin dirección</span>}</p>
          </div>
          <ResultadoBadge resultado={visita.resultado} />
        </div>
        {visita.motivo && <p className="text-xs text-muted-foreground">{visita.motivo}</p>}
        {visita.telefono && (
          <a href={`tel:${visita.telefono.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <Phone className="h-3.5 w-3.5" aria-hidden />{visita.telefono}
          </a>
        )}
        {!editing && visita.nota && <p className="whitespace-pre-line rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground">{visita.nota}</p>}
        {!editing && visita.visitadaAt && (
          <p className="text-xs text-muted-foreground">
            Anotado el {formatFechaHora(visita.visitadaAt)}{visita.visitadaPor ? ` por ${visita.visitadaPor}` : ""}
          </p>
        )}
        {editing ? (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-foreground">¿Qué pasó?</legend>
              <div className="flex flex-wrap gap-2">
                {VISITA_RESULTADOS.map((r) => (
                  <label
                    key={r.key}
                    className={`inline-flex min-h-10 cursor-pointer items-center rounded-xl border px-3 text-sm font-semibold ${resultado === r.key ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-card text-foreground"}`}
                  >
                    <input type="radio" name={`resultado-${visita.id}`} value={r.key} checked={resultado === r.key} onChange={() => setResultado(r.key)} className="sr-only" />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor={`nota-${visita.id}`}>Nota (opcional)</Label>
              <Textarea
                id={`nota-${visita.id}`}
                value={nota}
                maxLength={1000}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Qué se habló, qué necesita, a quién derivar…"
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button type="button" className="rounded-xl font-bold" disabled={saving} onClick={save}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Guardar
              </Button>
            </div>
          </div>
        ) : (
          canMark && (
            <Button type="button" variant={visita.resultado === "PENDIENTE" ? "default" : "outline"} size="sm" className="rounded-xl font-bold print:hidden" onClick={() => setEditing(true)}>
              {visita.resultado === "PENDIENTE" ? <><CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />Anotar la visita</> : <><Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />Corregir</>}
            </Button>
          )
        )}
      </div>
    </li>
  );
}

/** Sumar a alguien del padrón a la lista, por DNI. */
export function AddVisitaForm({ recorridaId }: { recorridaId: string }) {
  const router = useRouter();
  const [dni, setDni] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await addVisitaAction(recorridaId, dni).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo agregar. Probá de nuevo.");
    toast.success("Agregada al final de la lista.");
    setDni("");
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="flex gap-2 print:hidden">
      <label htmlFor="agregar-dni" className="sr-only">DNI de la persona a agregar</label>
      <Input id="agregar-dni" value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" placeholder="DNI de alguien más para visitar" className="h-10 rounded-xl" />
      <Button type="submit" variant="outline" disabled={saving || !dni.trim()} className="h-10 shrink-0 rounded-xl font-bold">
        {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}Agregar
      </Button>
    </form>
  );
}

/** Cambiar el día, para qué se sale y quiénes van. */
export function EditRecorridaDialog({
  id,
  barrio,
  fecha,
  objetivo,
  equipoIds,
  userOptions,
}: {
  id: string;
  barrio: string;
  fecha: string;
  objetivo: string | null;
  equipoIds: string[];
  userOptions: UserOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fecha: fecha.slice(0, 10), objetivo: objetivo ?? "", equipo: equipoIds });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateRecorridaAction(id, barrio, { fecha: form.fecha, objetivo: form.objetivo, equipoIds: form.equipo }).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    toast.success("Recorrida guardada.");
    setOpen(false);
    router.refresh();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm({ fecha: fecha.slice(0, 10), objetivo: objetivo ?? "", equipo: equipoIds });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl font-bold print:hidden"><Pencil className="mr-2 h-4 w-4" aria-hidden />Cambiar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cambiar la recorrida</DialogTitle>
            <DialogDescription>A quienes se sumen al equipo les llega un aviso.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="editar-fecha">Día <RequiredMark /></Label>
              <Input id="editar-fecha" type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} className="h-10 rounded-xl" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-objetivo">Para qué se sale</Label>
              <Input id="editar-objetivo" value={form.objetivo} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))} className="h-10 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quiénes salen</Label>
            <EquipoPicker idPrefix="equipo-editar" options={userOptions} value={form.equipo} onChange={(equipo) => setForm((f) => ({ ...f, equipo }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Dar la recorrida por hecha: qué se encontró y qué quedó pendiente (también para corregirlo después). */
export function TerminarRecorridaDialog({
  id,
  barrio,
  hallazgos,
  pendientes,
  done,
  sinVisitar,
}: {
  id: string;
  barrio: string;
  hallazgos: string | null;
  pendientes: string | null;
  done: boolean;
  sinVisitar: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ hallazgos: hallazgos ?? "", pendientes: pendientes ?? "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hallazgos.trim()) return toast.error("Contá brevemente qué se encontró en la recorrida.");
    setSaving(true);
    const res = await terminarRecorridaAction(id, barrio, form.hallazgos, form.pendientes).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    toast.success(done ? "Guardado." : "Recorrida terminada.");
    setOpen(false);
    router.refresh();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm({ hallazgos: hallazgos ?? "", pendientes: pendientes ?? "" });
      }}
    >
      <DialogTrigger asChild>
        {done ? (
          <Button variant="ghost" size="sm" className="rounded-xl font-bold print:hidden"><Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />Corregir</Button>
        ) : (
          <Button className="rounded-xl font-bold print:hidden"><CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />Terminar recorrida</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{done ? "Lo que se encontró" : "Terminar la recorrida"}</DialogTitle>
            <DialogDescription>
              {!done && sinVisitar > 0
                ? `Quedan ${sinVisitar === 1 ? "1 casa" : `${sinVisitar} casas`} sin anotar: se pueden anotar después.`
                : "Queda en la historia del barrio para la próxima recorrida."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="recorrida-hallazgos">¿Qué se encontró? <RequiredMark /></Label>
            <Textarea
              id="recorrida-hallazgos"
              value={form.hallazgos}
              maxLength={4000}
              onChange={(e) => setForm((f) => ({ ...f, hallazgos: e.target.value }))}
              placeholder="Por ejemplo: la calle Perón sigue inundada; varias familias piden colchones."
              className="min-h-28 rounded-xl"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recorrida-pendientes">¿Qué quedó pendiente? (opcional)</Label>
            <Textarea
              id="recorrida-pendientes"
              value={form.pendientes}
              maxLength={4000}
              onChange={(e) => setForm((f) => ({ ...f, pendientes: e.target.value }))}
              placeholder="Por ejemplo: volver a lo de los que no estaban; avisar a Hábitat por la vivienda de la calle 12."
              className="min-h-20 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}{done ? "Guardar" : "Terminar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Borrar la recorrida (quien la armó o la conducción). */
export function DeleteRecorridaButton({ id, backHref }: { id: string; backHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const remove = async () => {
    setSaving(true);
    const res = await deleteRecorridaAction(id).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo borrar. Probá de nuevo.");
    toast.success("Recorrida borrada.");
    router.push(backHref);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive print:hidden" aria-label="Borrar la recorrida">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Borrar la recorrida?</DialogTitle>
          <DialogDescription>Se borra con su lista y lo anotado en cada visita. No se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
          <Button type="button" variant="destructive" disabled={saving} onClick={remove} className="rounded-xl font-bold">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
