"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { Field, FormSection, fieldSelectClass } from "@/components/ui/form-section";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmar } from "@/components/ui/confirm-dialog";
import { EmptyMessage } from "@/components/ui/empty-message";
import { LEAVE_KINDS, LEAVE_TONE_CLASS, dayToDate, leaveDays, leaveKindLabel, leaveKindTone } from "@/lib/hr-leaves";
import { deleteLeaveAction, registerLeaveAction } from "../../actions/hr-actions";

export type LeaveItem = { id: string; kind: string; startDate: string; endDate: string; notes: string | null };

const fmt = (day: string) => day.split("-").reverse().join("/");
const days = (n: number) => (n === 1 ? "1 día" : `${n} días`);

/** "Licencias y vacaciones" del legajo: lo que tomó en el año, el historial y "Registrar licencia". */
export function LeavesSection({
  agentId,
  leaves,
  today,
  year,
  summary,
  canEdit,
}: {
  agentId: string;
  leaves: LeaveItem[];
  /** "AAAA-MM-DD", en la hora argentina. */
  today: string;
  year: number;
  summary: { total: number; byKind: { kind: string; label: string; days: number }[] };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);

  const s = dayToDate(start);
  const e = dayToDate(end);
  const count = s && e && e >= s ? leaveDays(s, e) : 0;

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSaving(true);
    const res = await registerLeaveAction(agentId, new FormData(ev.currentTarget)).catch(() => null);
    setSaving(false);
    if (res?.success) {
      toast.success("Se guardó la licencia.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error((res && !res.success && res.error) || "No se pudo guardar la licencia. Probá de nuevo.");
    }
  }

  async function remove(l: LeaveItem) {
    const ok = await confirmar({
      title: "¿Borrar esta licencia?",
      description: `${leaveKindLabel(l.kind)}, del ${fmt(l.startDate)} al ${fmt(l.endDate)}. Usalo solo si se cargó por error.`,
      confirmLabel: "Borrar",
      danger: true,
    });
    if (!ok) return;
    setDeleting(l.id);
    const res = await deleteLeaveAction(l.id).catch(() => null);
    setDeleting(null);
    if (res?.success) {
      toast.success("Se borró la licencia.");
      router.refresh();
    } else {
      toast.error((res && !res.success && res.error) || "No se pudo borrar la licencia.");
    }
  }

  return (
    <FormSection
      icon={CalendarDays}
      title="Licencias y vacaciones"
      description={`En ${year}: ${summary.total ? `${days(summary.total)} corridos` : "ninguna todavía"}.`}
      actions={
        canEdit ? (
          <Button
            size="sm"
            className="gap-1.5 print:hidden"
            onClick={() => {
              setStart(today);
              setEnd(today);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Registrar licencia
          </Button>
        ) : undefined
      }
    >
      {summary.byKind.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`Días por tipo en ${year}`}>
          {summary.byKind.map((k) => (
            <li key={k.kind} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium">
              <span className={`h-2 w-2 rounded-full ${LEAVE_TONE_CLASS[leaveKindTone(k.kind)].dot}`} aria-hidden />
              {k.label}: <span className="font-semibold tabular-nums">{days(k.days)}</span>
            </li>
          ))}
        </ul>
      )}

      {leaves.length === 0 ? (
        <EmptyMessage compact title="Sin licencias cargadas" description="Cuando se registre una licencia o unas vacaciones, van a quedar acá." />
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {leaves.map((l) => {
            const n = leaveDays(dayToDate(l.startDate)!, dayToDate(l.endDate)!);
            const now = l.startDate <= today && l.endDate >= today;
            const next = l.startDate > today;
            return (
              <li key={l.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${LEAVE_TONE_CLASS[leaveKindTone(l.kind)].dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {leaveKindLabel(l.kind)}
                    {now && <StatusBadge tone="amber">En curso</StatusBadge>}
                    {next && <StatusBadge tone="blue">Próxima</StatusBadge>}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {l.startDate === l.endDate ? `El ${fmt(l.startDate)}` : `Del ${fmt(l.startDate)} al ${fmt(l.endDate)}`} · {days(n)}
                  </p>
                  {l.notes && <p className="mt-0.5 text-xs text-muted-foreground">{l.notes}</p>}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600 print:hidden"
                    aria-label={`Borrar ${leaveKindLabel(l.kind)} del ${fmt(l.startDate)}`}
                    disabled={deleting === l.id}
                    onClick={() => remove(l)}
                  >
                    {deleting === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar licencia</DialogTitle>
            <DialogDescription>Si incluye el día de hoy, la situación del legajo cambia sola hasta el último día.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Tipo" htmlFor="leave-kind" required>
              <select id="leave-kind" name="kind" required defaultValue="VACACIONES" className={fieldSelectClass}>
                {LEAVE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desde" htmlFor="leave-start" required>
                <Input id="leave-start" name="startDate" type="date" required value={start} onChange={(ev) => setStart(ev.target.value)} />
              </Field>
              <Field label="Hasta" htmlFor="leave-end" required>
                <Input id="leave-end" name="endDate" type="date" required min={start} value={end} onChange={(ev) => setEnd(ev.target.value)} />
              </Field>
            </div>
            <p className={`text-xs ${count ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}>
              {count ? `Son ${days(count)} corridos, los dos incluidos.` : "El último día tiene que ser el mismo o después del primero."}
            </p>
            <Field label="Observaciones" htmlFor="leave-notes">
              <Textarea id="leave-notes" name="notes" rows={2} maxLength={300} placeholder="Por ejemplo: certificado médico presentado." />
            </Field>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !count} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Guardando…" : "Guardar licencia"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </FormSection>
  );
}
