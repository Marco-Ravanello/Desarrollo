"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import {
  parseViewerIds, taskDueParts, TASK_NOTES_MAX, TASK_PRIORITIES, TASK_TITLE_MAX, type TaskPriority,
} from "@/lib/tasks";
import { updateTaskAction } from "./actions";

export type ShareableUser = { id: string; name: string; areaName: string | null };

type EditableTask = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | Date | null;
  priority?: string | null;
  viewerIds?: string | null;
};

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
  const [shared, setShared] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const reset = () => {
    const due = taskDueParts(task.dueDate);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDay(due.day);
    setTime(due.time);
    setPriority((TASK_PRIORITIES.find((p) => p.value === task.priority)?.value ?? "MEDIA") as TaskPriority);
    setShared(parseViewerIds(task.viewerIds));
    setSearch("");
  };

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const matches = useMemo(() => {
    const q = normal(search.trim());
    const list = q ? users.filter((u) => normal(`${u.name} ${u.areaName ?? ""}`).includes(q)) : users;
    return list.slice(0, 50);
  }, [search, users]);

  const toggle = (id: string) => setShared((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

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
            <Label htmlFor="tarea-titulo">Título</Label>
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
            {shared.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {shared.map((id) => (
                  <li key={id} className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 py-0.5 pl-1 pr-1 text-xs font-medium">
                    <InitialsAvatar name={byId.get(id)?.name ?? "?"} seed={id} size="xs" />
                    {byId.get(id)?.name ?? "Usuario dado de baja"}
                    <button type="button" onClick={() => toggle(id)} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                      <span className="sr-only">Dejar de compartir con {byId.get(id)?.name ?? "este usuario"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Solo la ves vos.</p>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tarea-compartir"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o área"
                className="rounded-xl pl-9"
              />
            </div>
            <ul className="max-h-44 divide-y divide-border/30 overflow-y-auto rounded-xl border border-border/50">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">Nadie coincide con la búsqueda.</li>
              ) : (
                matches.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/30">
                      <input type="checkbox" checked={shared.includes(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 accent-primary" />
                      <InitialsAvatar name={u.name} seed={u.id} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{u.name}</span>
                        {u.areaName && <span className="block truncate text-xs text-muted-foreground">{u.areaName}</span>}
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
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
