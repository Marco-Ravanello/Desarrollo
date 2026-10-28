"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2, Circle, Trash2, Plus, Search, Calendar as CalendarIcon,
  AlertTriangle, Sparkles, FileText, Clock, Users, Repeat, Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyMessage } from "@/components/ui/empty-message";
import { addTaskAction, toggleTaskAction, deleteTaskAction } from "./actions";
import { toast } from "sonner";
import Link from "next/link";
import { diaAR, diaDeVencimiento, diasEntre, formatVencimiento } from "@/lib/fechas";
import { parseViewerIds, repeatLabel, TASK_PRIORITIES, TASK_REPEATS } from "@/lib/tasks";
import { EditTaskDialog, type ShareableUser } from "./edit-task-dialog";

type PriorityType = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  dueDate?: string | Date | null;
  status: "PENDIENTE" | "EN_PROCESO" | "COMPLETADA";
  priority?: PriorityType;
  createdAt: string | Date;
  /** Seguimiento agendado desde un expediente. */
  case?: { id: string; title: string } | null;
  /** Con quién se comparte ("id1,id2"). */
  viewerIds?: string | null;
  /** Cada cuánto se repite ("SEMANAL", "QUINCENAL", "MENSUAL"). */
  repeat?: string | null;
}

/** Una tarea que otra persona compartió: se ve, pero la maneja quien la creó. */
export interface SharedTaskItem extends Omit<TaskItem, "case"> {
  ownerName: string;
  caseId?: string | null;
}

type Tab = "PENDIENTES" | "REALIZADAS" | "TODAS" | "COMPARTIDAS";

export function TaskList({
  initialTasks,
  sharedTasks = [],
  canManageAll = false,
  users = [],
}: {
  initialTasks: TaskItem[];
  sharedTasks?: SharedTaskItem[];
  /** La conducción también marca y edita las tareas de los demás. */
  canManageAll?: boolean;
  userId: string;
  users?: ShareableUser[];
}) {
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<PriorityType>("MEDIA");
  const [repeat, setRepeat] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("PENDIENTES");
  const [priorityFilter, setPriorityFilter] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState("");

  const [isPending, startTransition] = useTransition();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Escribí el título de la tarea");
      return;
    }

    startTransition(async () => {
      try {
        const result = await addTaskAction(
          title.trim(),
          description.trim() || undefined,
          dueDate || null,
          priority,
          dueDate ? repeat || null : null
        );
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setTitle("");
        setDescription("");
        setDueDate("");
        setPriority("MEDIA");
        setRepeat("");
        toast.success("Tarea registrada correctamente");
      } catch {
        toast.error("No se pudo guardar la tarea. Revisá la conexión y probá de nuevo.");
      }
    });
  };

  const handleToggle = (id: string, currentStatus: string) => {
    startTransition(async () => {
      try {
        const result = await toggleTaskAction(id, currentStatus);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(
          currentStatus === "COMPLETADA"
            ? "Tarea reabierta"
            : result.next
            ? `¡Tarea completada! La próxima quedó para el ${formatVencimiento(result.next)}.`
            : "¡Tarea completada!"
        );
      } catch {
        toast.error("No se pudo actualizar la tarea. Revisá la conexión y probá de nuevo.");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const result = await deleteTaskAction(id);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Tarea eliminada");
      } catch {
        toast.error("No se pudo eliminar la tarea. Revisá la conexión y probá de nuevo.");
      }
    });
  };

  const source: (TaskItem | SharedTaskItem)[] = activeTab === "COMPARTIDAS" ? sharedTasks : initialTasks;
  const filteredTasks = source.filter((t) => {
    if (activeTab === "PENDIENTES" && t.status === "COMPLETADA") return false;
    if (activeTab === "REALIZADAS" && t.status !== "COMPLETADA") return false;

    if (priorityFilter !== "TODAS" && (t.priority || "MEDIA") !== priorityFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchDesc) return false;
    }

    return true;
  });

  const countPendientes = initialTasks.filter((t) => t.status !== "COMPLETADA").length;
  const countRealizadas = initialTasks.filter((t) => t.status === "COMPLETADA").length;
  const countTodas = initialTasks.length;
  const countCompartidas = sharedTasks.filter((t) => t.status !== "COMPLETADA").length;

  const renderDueDateBadge = (dueDateStr?: string | Date | null) => {
    if (!dueDateStr) return null;
    const diffDays = diasEntre(diaAR(new Date()), diaDeVencimiento(dueDateStr));
    const formatted = formatVencimiento(dueDateStr);

    if (diffDays < 0) {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs font-bold gap-1">
          <AlertTriangle className="h-3 w-3" />
          Venció el {formatted}
        </Badge>
      );
    } else if (diffDays === 0) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-bold gap-1">
          <Clock className="h-3 w-3" />
          Vence hoy
        </Badge>
      );
    } else if (diffDays === 1) {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs font-bold gap-1">
          <CalendarIcon className="h-3 w-3" />
          Vence mañana
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-border/60 text-muted-foreground text-xs font-bold gap-1">
          <CalendarIcon className="h-3 w-3" />
          Vence el {formatted}
        </Badge>
      );
    }
  };

  const renderPriorityBadge = (p?: PriorityType) => {
    const val = p || "MEDIA";
    switch (val) {
      case "URGENTE":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-bold gap-1.5">
            <PriorityDot priority="URGENTE" /> Urgente
          </Badge>
        );
      case "ALTA":
        return (
          <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 text-xs font-bold gap-1.5">
            <PriorityDot priority="ALTA" /> Alta
          </Badge>
        );
      case "MEDIA":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-xs font-bold gap-1.5">
            <PriorityDot priority="MEDIA" /> Normal
          </Badge>
        );
      case "BAJA":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold gap-1.5">
            <PriorityDot priority="BAJA" /> Baja
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                aria-label="Qué hay que hacer"
                placeholder="¿Qué hay que hacer?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 h-11 rounded-2xl bg-muted/30 border-border/60 text-sm text-foreground font-medium"
              />
              <Button
                type="submit"
                disabled={isPending}
                className="hidden sm:inline-flex h-11 px-5 rounded-2xl font-bold text-xs gap-2 shrink-0 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Agregar tarea</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                aria-label="Notas"
                placeholder="Notas (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9 rounded-xl bg-muted/20 border-border/60 text-xs text-foreground"
              />

              <div className="flex items-center gap-2">
                <span id="nueva-tarea-prioridad" className="text-xs font-semibold text-muted-foreground shrink-0">Prioridad</span>
                <div role="group" aria-labelledby="nueva-tarea-prioridad" className="grid w-full grid-cols-4 gap-1 rounded-xl border border-border/40 bg-muted/30 p-1">
                  {TASK_PRIORITIES.map((p) => {
                    const isSel = priority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        aria-pressed={isSel}
                        onClick={() => setPriority(p.value)}
                        className={`flex items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold transition-colors ${
                          isSel ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {!isSel && <PriorityDot priority={p.value} />}
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="nueva-tarea-fecha" className="text-xs font-semibold text-muted-foreground shrink-0">Fecha</label>
                <Input
                  id="nueva-tarea-fecha"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 rounded-xl bg-muted/20 border-border/60 text-xs text-foreground"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="nueva-tarea-repetir" className="text-xs font-semibold text-muted-foreground shrink-0">Repetir</label>
                <select
                  id="nueva-tarea-repetir"
                  value={dueDate ? repeat : ""}
                  disabled={!dueDate}
                  onChange={(e) => setRepeat(e.target.value)}
                  title={dueDate ? undefined : "Para que se repita, primero elegí la fecha."}
                  className="h-9 w-full rounded-xl border border-border/60 bg-muted/20 px-3 text-xs font-semibold text-foreground disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">{dueDate ? "No se repite" : "No se repite (elegí la fecha)"}</option>
                  {TASK_REPEATS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" disabled={isPending} className="sm:hidden h-11 w-full rounded-2xl font-bold text-xs gap-2">
              <Plus className="h-4 w-4" />
              <span>Agregar tarea</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-muted/30 p-1 rounded-2xl border border-border/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("PENDIENTES")}
            className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "PENDIENTES"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Pendientes</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-md tabular-nums">
              {countPendientes}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("REALIZADAS")}
            className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "REALIZADAS"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Realizadas</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-md tabular-nums">
              {countRealizadas}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TODAS")}
            className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "TODAS"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Todas</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-md tabular-nums">
              {countTodas}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("COMPARTIDAS")}
            className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "COMPARTIDAS"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="sm:hidden">Compartidas</span>
            <span className="hidden sm:inline">Compartidas conmigo</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-md tabular-nums">
              {countCompartidas}
            </Badge>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar en tareas"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/60 text-foreground"
            />
          </div>

          <select
            aria-label="Filtrar por prioridad"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 rounded-xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="TODAS">Todas las prioridades</option>
            <option value="URGENTE">Urgente</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Normal</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <Card className="bg-card text-card-foreground border-2 border-dashed border-border/60 rounded-2xl">
            {searchQuery.trim() || priorityFilter !== "TODAS" ? (
              <EmptyMessage
                kind="search"
                title="Ninguna tarea coincide con la búsqueda"
                description="Probá con otras palabras o con otra prioridad."
                icon={Sparkles}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => {
                      setSearchQuery("");
                      setPriorityFilter("TODAS");
                    }}
                  >
                    Quitar filtros
                  </Button>
                }
              />
            ) : activeTab === "COMPARTIDAS" ? (
              <EmptyMessage
                title="Nadie te compartió tareas"
                description="Cuando alguien te sume a una tarea desde la Agenda o desde Mis tareas, la ves acá."
                icon={Share2}
              />
            ) : activeTab === "PENDIENTES" ? (
              <EmptyMessage kind="done" title="No tenés tareas pendientes" description="Cuando agendes una tarea, aparece acá." icon={Sparkles} />
            ) : (
              <EmptyMessage title="Todavía no hay tareas en esta lista" description="Las tareas que cargues aparecen acá." icon={Sparkles} />
            )}
          </Card>
        ) : (
          filteredTasks.map((t) => {
            const isDone = t.status === "COMPLETADA";
            const shared = "ownerName" in t ? t : null;
            // Las compartidas las marca y edita quien las creó (o la conducción).
            const canEdit = !shared || canManageAll;
            return (
              <Card
                key={t.id}
                className={`bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl hover:border-border transition-all ${
                  isDone ? "opacity-60 bg-muted/20" : ""
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleToggle(t.id, t.status)}
                        disabled={isPending}
                        className="mt-0.5 shrink-0 focus:outline-none"
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        )}
                        <span className="sr-only">{isDone ? `Volver a dejar pendiente ${t.title}` : `Marcar como hecha ${t.title}`}</span>
                      </button>
                    ) : isDone ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-label="Hecha" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" aria-label="Pendiente" />
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold text-foreground leading-snug ${
                            isDone ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {t.title}
                        </span>
                        {renderPriorityBadge(t.priority)}
                        {renderDueDateBadge(t.dueDate)}
                        {repeatLabel(t.repeat) && (
                          <Badge variant="outline" className="border-border/60 text-muted-foreground text-xs font-bold gap-1">
                            <Repeat className="h-3 w-3" aria-hidden />
                            {repeatLabel(t.repeat)}
                          </Badge>
                        )}
                      </div>

                      {shared && (
                        <p className="text-xs font-semibold text-muted-foreground">
                          De {shared.ownerName}
                          {!canEdit && <span className="font-normal"> · la marca como hecha quien la creó</span>}
                        </p>
                      )}

                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      )}

                      {!shared && parseViewerIds(t.viewerIds).length > 0 && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            Compartida con {parseViewerIds(t.viewerIds).map((id) => userName.get(id) ?? "un usuario dado de baja").join(", ")}
                          </span>
                        </p>
                      )}

                      {shared?.caseId && (
                        <Link
                          href={`/cases/${shared.caseId}`}
                          className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">Es un seguimiento de un expediente</span>
                        </Link>
                      )}

                      {"case" in t && t.case && (
                        <Link
                          href={`/cases/${t.case.id}`}
                          className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">Expediente: {t.case.title}</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                  <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
                    <EditTaskDialog task={t} users={users} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(t.id)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Borrar la tarea {t.title}</span>
                    </Button>
                  </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

const DOT_CLASS: Record<string, string> = {
  URGENTE: "bg-rose-500",
  ALTA: "bg-amber-500",
  MEDIA: "bg-blue-500",
  BAJA: "bg-emerald-500",
};

/** Punto de color de la prioridad (siempre va con el nombre al lado). */
function PriorityDot({ priority }: { priority: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[priority] ?? DOT_CLASS.MEDIA}`} />;
}
