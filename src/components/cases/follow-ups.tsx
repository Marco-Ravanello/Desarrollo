"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { completeFollowUpAction, scheduleFollowUpAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { addDays, FOLLOW_UP_MAX_DAYS, FOLLOW_UP_NOTE_MAX } from "@/lib/follow-up-dates";
import type { CaseFollowUp } from "@/services/follow-ups";

const QUICK = [
  { label: "Mañana", days: 1 },
  { label: "En una semana", days: 7 },
  { label: "En 15 días", days: 15 },
  { label: "En un mes", days: 30 },
];

const fechaLarga = (isoDay: string) =>
  new Date(`${isoDay}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Botón con diálogo para agendar un seguimiento del expediente. */
export function ScheduleFollowUpButton({ caseId, today }: { caseId: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(addDays(today, 7));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!day) return toast.error("Elegí la fecha.");
    setSaving(true);
    const res = await scheduleFollowUpAction(caseId, day, note).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo agendar. Probá de nuevo.");
    toast.success(`Seguimiento agendado para el ${fechaLarga(day)}.`);
    setOpen(false);
    setNote("");
    setDay(addDays(today, 7));
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl font-bold gap-1.5">
          <CalendarClock className="h-4 w-4" /> Agendar seguimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Agendar seguimiento</DialogTitle>
            <DialogDescription>
              Queda en tus tareas y ese día te llega un aviso a la campanita para volver a este expediente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="seguimiento-fecha" className="text-xs font-bold">¿Cuándo?</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => {
                const value = addDays(today, q.days);
                const active = day === value;
                return (
                  <button
                    key={q.days}
                    type="button"
                    onClick={() => setDay(value)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-muted/40 text-foreground hover:bg-muted"
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            <Input
              id="seguimiento-fecha"
              type="date"
              value={day}
              min={today}
              max={addDays(today, FOLLOW_UP_MAX_DAYS)}
              onChange={(e) => setDay(e.target.value)}
              className="h-10 rounded-xl"
              required
            />
            {day && <p className="text-xs text-muted-foreground first-letter:uppercase">{fechaLarga(day)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seguimiento-nota" className="text-xs font-bold">
              ¿Qué hay que hacer? <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="seguimiento-nota"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={FOLLOW_UP_NOTE_MAX}
              placeholder="Ej: Llamar a la titular para ver si recibió el módulo."
              className="min-h-[80px] text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || !day} className="rounded-xl font-bold gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Seguimientos pendientes del expediente. Quien lo agendó lo marca como hecho. */
export function FollowUpList({ items, today, currentUserId }: { items: CaseFollowUp[]; today: string; currentUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const done = async (id: string) => {
    setBusy(id);
    const res = await completeFollowUpAction(id).catch(() => null);
    setBusy(null);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo marcar. Probá de nuevo.");
    toast.success("Seguimiento hecho.");
    router.refresh();
  };

  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        Seguimientos agendados ({items.length})
      </p>
      <ul className="mt-2 divide-y divide-border/40">
        {items.map((f) => {
          const day = f.dueDate.slice(0, 10);
          const isToday = day === today;
          const mine = f.userId === currentUserId;
          return (
            <li key={f.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-foreground first-letter:uppercase">{fechaLarga(day)}</span>
                  {(isToday || f.overdue) && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        f.overdue
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          : "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      {f.overdue ? "Atrasado" : "Hoy"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground break-words">{f.title}</p>
                <p className="text-xs text-muted-foreground">{mine ? "Lo agendaste vos" : `Lo agendó ${f.userName || "otra persona"}`}</p>
              </div>
              {mine && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => done(f.id)}
                  disabled={busy === f.id}
                  className="h-8 shrink-0 self-start rounded-xl text-xs font-bold gap-1 sm:self-center"
                >
                  {busy === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Hecho
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
