"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  parseViewerIds, taskDueParts, TASK_NOTES_MAX, TASK_PRIORITIES, TASK_REPEATS, TASK_TITLE_MAX, type TaskPriority,
} from "@/lib/tasks";
import { updateTaskAction } from "./actions";
import { RequiredMark } from "@/components/ui/form-section";
import { SharePicker, type ShareableUser } from "@/components/tasks/share-picker";

export type { ShareableUser };

type EditableTask = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | Date | null;
  priority?: string | null;
  viewerIds?: string | null;
  repeat?: string | null;
};

/** Botón con lápiz que abre el formulario para cambiar una tarea. */
export function EditTaskDialog({ task, users }: { task: EditableTask; users: ShareableUser[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIA");
  const [repeat, setRepeat] = useState("");
  const [shared, setShared] = useState<string[]>([]);

  const reset = () => {
    const due = taskDueParts(task.dueDate);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDay(due.day);
    setTime(due.time);
    setPriority((TASK_PRIORITIES.find((p) => p.value === task.priority)?.value ?? "MEDIA") as TaskPriority);
    setShared(parseViewerIds(task.viewerIds));
    setRepeat(task.repeat ?? "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Escribí el título de la tarea.");
    setSaving(true);
    const res = await updateTaskAction(task.id, {
      title,
      description,
      day: day || null,
      time: day ? time : null,
      priority,
      viewerIds: shared,
      repeat: day ? repeat || null : null,
    }).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    toast.success("Tarea guardada.");
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
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Editar la tarea {task.title}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <DialogHeader>
            <DialogTitle>Editar tarea</DialogTitle>
            <DialogDescription>Cambiá lo que necesites y guardá. Quienes la tengan compartida la ven en su Agenda.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="tarea-titulo">Título <RequiredMark /></Label>
            <Input id="tarea-titulo" value={title} maxLength={TASK_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} required className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tarea-notas">Notas (opcional)</Label>
            <Textarea id="tarea-notas" value={description} maxLength={TASK_NOTES_MAX} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tarea-dia">Fecha</Label>
              <Input id="tarea-dia" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tarea-hora">Hora</Label>
              <Input id="tarea-hora" type="time" value={time} disabled={!day} onChange={(e) => setTime(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          {day && (
            <button type="button" onClick={() => setDay("")} className="-mt-2 text-xs font-semibold text-primary hover:underline">
              Dejarla sin fecha
            </button>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tarea-repetir">Repetir</Label>
            <select
              id="tarea-repetir"
              value={day ? repeat : ""}
              disabled={!day}
              onChange={(e) => setRepeat(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-60"
            >
              <option value="">{day ? "No se repite" : "No se repite (elegí la fecha)"}</option>
              {TASK_REPEATS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {day && repeat && <p className="text-xs text-muted-foreground">Al marcarla como hecha, se crea sola la próxima.</p>}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Prioridad</legend>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
              {TASK_PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={priority === p.value}
                  onClick={() => setPriority(p.value)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                    priority === p.value ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="tarea-compartir">Compartida con</Label>
            <SharePicker users={users} value={shared} onChange={setShared} inputId="tarea-compartir" />
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
