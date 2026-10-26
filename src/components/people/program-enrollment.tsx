"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, History, Loader2, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { enrollInProgramAction, withdrawFromProgramAction } from "@/app/(dashboard)/people/actions/program-enrollment-actions";
import type { ProgramMovement, ProgramOption } from "@/services/program-enrollment";

const NOTE_MAX = 300;
const ORIGEN: Record<string, string> = { IMPORTACION: "por planilla", TORMENTA: "por ficha de tormenta" };

const dayText = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

function EnrollDialog({ dni, available, today }: { dni: string; available: ProgramOption[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [column, setColumn] = useState("");
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!column) return toast.error("Elegí el programa.");
    setSaving(true);
    const res = await enrollInProgramAction(dni, column, day, note).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success("Alta registrada.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) { setColumn(""); setDay(today); setNote(""); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl font-bold gap-1.5" disabled={available.length === 0}>
          <Plus className="h-4 w-4" /> Dar de alta en un programa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Dar de alta en un programa</DialogTitle>
            <DialogDescription>Queda en el padrón y en la historia de la persona, con la fecha y tu nombre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="alta-programa">Programa</Label>
            <select id="alta-programa" value={column} onChange={(e) => setColumn(e.target.value)} className={selectClass} required>
              <option value="" disabled>Elegí el programa…</option>
              {available.map((p) => (
                <option key={p.column} value={p.column}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alta-fecha">Desde</Label>
            <Input id="alta-fecha" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} required className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alta-nota">Nota (opcional)</Label>
            <Textarea
              id="alta-nota"
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Ingresa por derivación de Niñez."
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Dar de alta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ dni, program, today }: { dni: string; program: ProgramOption; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Escribí el motivo de la baja.");
    setSaving(true);
    const res = await withdrawFromProgramAction(dni, program.column, day, reason).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success("Baja registrada.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) { setDay(today); setReason(""); }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs font-bold text-muted-foreground hover:text-foreground">
          <LogOut className="h-3.5 w-3.5" /> Dar de baja
          <span className="sr-only"> de {program.label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Dar de baja de {program.label}</DialogTitle>
            <DialogDescription>Deja de figurar en el programa. Su paso por el programa queda en la historia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="baja-fecha">Desde</Label>
            <Input id="baja-fecha" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} required className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="baja-motivo">Motivo</Label>
            <Textarea
              id="baja-motivo"
              value={reason}
              maxLength={NOTE_MAX}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Se mudó fuera del partido. / Terminó el curso. / Ya no cumple los requisitos."
              required
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Dar de baja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Arriba de la pestaña Programas: en qué programas está hoy, botones de alta y baja, y la historia. */
export function ProgramEnrollmentPanel({
  dni,
  active,
  available,
  history,
  canManage,
  today,
}: {
  dni: string;
  active: ProgramOption[];
  available: ProgramOption[];
  history: ProgramMovement[];
  canManage: boolean;
  today: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? history : history.slice(0, 5);

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">Programas en los que está hoy</h3>
        {canManage && <EnrollDialog dni={dni} available={available} today={today} />}
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground">No está en ningún programa de la lista.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {active.map((p) => (
            <li key={p.column} className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 py-1 pl-3 pr-1 text-xs font-semibold text-foreground">
              {p.label}
              {canManage && <WithdrawDialog dni={dni} program={p} today={today} />}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-border/40 pt-3">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Historia de altas y bajas
        </h4>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay altas ni bajas registradas. Las que vengan del padrón original no tienen fecha.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {shown.map((m) => (
              <li key={m.id} className="flex items-start gap-3 py-2 text-xs">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    m.tipo === "ALTA"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {m.tipo === "ALTA" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">
                    {m.tipo === "ALTA" ? "Alta en" : "Baja de"} {m.programa}
                    <span className="font-normal text-muted-foreground"> · desde el {dayText(m.fecha)}</span>
                  </p>
                  {m.motivo && <p className="text-foreground">{m.tipo === "BAJA" ? `Motivo: ${m.motivo}` : m.motivo}</p>}
                  <p className="text-muted-foreground">{[m.autor, ORIGEN[m.origen]].filter(Boolean).join(" · ") || "Sin dato de quién"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {history.length > 5 && (
          <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-xs font-bold text-primary" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Ver menos" : `Ver las ${history.length}`}
          </Button>
        )}
      </div>
    </div>
  );
}
