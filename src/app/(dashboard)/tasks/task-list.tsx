"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2, Circle, Trash2, Plus, Search, Calendar as CalendarIcon,
  AlertTriangle, Filter, Sparkles, FileText, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addTaskAction, toggleTaskAction, deleteTaskAction } from "./actions";
import { toast } from "sonner";

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
}

export function TaskList({ initialTasks, userId }: { initialTasks: TaskItem[], userId: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<PriorityType>("MEDIA");

  const [activeTab, setActiveTab] = useState<"PENDIENTES" | "REALIZADAS" | "TODAS">("PENDIENTES");
  const [priorityFilter, setPriorityFilter] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState("");

  const [isPending, startTransition] = useTransition();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Por favor ingrese el título de la tarea");
      return;
    }

    startTransition(async () => {
      try {
        await addTaskAction(
          title.trim(),
          description.trim() || undefined,
          dueDate || null,
          priority
        );
        setTitle("");
        setDescription("");
        setDueDate("");
        setPriority("MEDIA");
        toast.success("Tarea registrada correctamente");
      } catch (err: any) {
        toast.error(err.message || "Error al registrar la tarea");
      }
    });
  };

  const handleToggle = (id: string, currentStatus: string) => {
    startTransition(async () => {
      try {
        await toggleTaskAction(id, currentStatus);
        toast.success(currentStatus === "COMPLETADA" ? "Tarea reabierta" : "¡Tarea completada!");
      } catch (err: any) {
        toast.error(err.message || "Error al actualizar estado");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteTaskAction(id);
        toast.success("Tarea eliminada");
      } catch (err: any) {
        toast.error(err.message || "Error al eliminar tarea");
      }
    });
  };

  const filteredTasks = initialTasks.filter((t) => {
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

  const renderDueDateBadge = (dueDateStr?: string | Date | null) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueZero = new Date(due);
    dueZero.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueZero.getTime() - today.getTime()) / (1000 * 3600 * 24));

    const formatted = due.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

    if (diffDays < 0) {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] font-bold gap-1">
          <AlertTriangle className="h-3 w-3" />
          Venció el {formatted}
        </Badge>
      );
    } else if (diffDays === 0) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-bold gap-1">
          <Clock className="h-3 w-3" />
          Vence hoy
        </Badge>
      );
    } else if (diffDays === 1) {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px] font-bold gap-1">
          <CalendarIcon className="h-3 w-3" />
          Vence mañana
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-border/60 text-muted-foreground text-[10px] font-bold gap-1">
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
          <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/30 text-[10px] font-bold">
            🔴 Urgente
          </Badge>
        );
      case "ALTA":
        return (
          <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-bold">
            🟠 Alta
          </Badge>
        );
      case "MEDIA":
        return (
          <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/30 text-[10px] font-bold">
            🟡 Normal
          </Badge>
        );
      case "BAJA":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold">
            🟢 Baja
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="¿Qué compromiso o trámite hay que realizar?..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 h-11 rounded-2xl bg-muted/30 border-border/60 text-xs sm:text-sm text-foreground font-medium"
              />
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 px-5 rounded-2xl font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Agregar Tarea</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-1">
                <Input
                  placeholder="Notas opcionales o detalles..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 rounded-xl bg-muted/20 border-border/60 text-xs text-foreground"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase shrink-0">Prioridad:</span>
                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/40 w-full justify-between">
                  {(["URGENTE", "ALTA", "MEDIA", "BAJA"] as PriorityType[]).map((p) => {
                    const isSel = priority === p;
                    const labels: Record<PriorityType, string> = {
                      URGENTE: "🔴 URG",
                      ALTA: "🟠 ALTA",
                      MEDIA: "🟡 NOR",
                      BAJA: "🟢 BAJA"
                    };
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`text-[10px] font-black px-2 py-1 rounded-lg transition-all ${
                          isSel
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase shrink-0">Vencimiento:</span>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 rounded-xl bg-muted/20 border-border/60 text-xs text-foreground"
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-2xl border border-border/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("PENDIENTES")}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "PENDIENTES"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Pendientes</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md font-mono">
              {countPendientes}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("REALIZADAS")}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "REALIZADAS"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Realizadas</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md font-mono">
              {countRealizadas}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TODAS")}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "TODAS"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Todas</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md font-mono">
              {countTodas}
            </Badge>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar en tareas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/60 text-foreground"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 rounded-xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="TODAS">Prioridad: Todas</option>
            <option value="URGENTE">🔴 Urgente</option>
            <option value="ALTA">🟠 Alta</option>
            <option value="MEDIA">🟡 Normal</option>
            <option value="BAJA">🟢 Baja</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <Card className="bg-card text-card-foreground border-2 border-dashed border-border/60 rounded-3xl p-12 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
            <p className="text-sm font-bold text-foreground">No hay tareas para mostrar.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Pruebe cambiando los filtros de búsqueda o registre un nuevo compromiso.
            </p>
          </Card>
        ) : (
          filteredTasks.map((t) => {
            const isDone = t.status === "COMPLETADA";
            return (
              <Card
                key={t.id}
                className={`bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl hover:border-border transition-all ${
                  isDone ? "opacity-60 bg-muted/20" : ""
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
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
                    </button>

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
                      </div>

                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(t.id)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
