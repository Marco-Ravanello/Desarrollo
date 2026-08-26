"use client";

import { useState } from "react";
import {
  ChevronLeft, ChevronRight, Calendar, User, Briefcase,
  Clock, CheckSquare, ShoppingBag, Plus, X, Globe, Eye,
  Edit2, Save, Trash2, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import {
  rescheduleTaskAction,
  rescheduleReservationAction,
  reschedulePurchaseOrderAction,
  createSharedTaskAction
} from "@/app/(dashboard)/admin/actions/calendar-actions";

interface UnifiedCalendarProps {
  reservations: any[];
  purchaseOrders: any[];
  tasks: any[];
  users: any[];
  currentUserId: string;
}

type CalendarViewType = "month" | "week" | "day" | "agenda";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

export function UnifiedCalendar({ reservations, purchaseOrders, tasks, users, currentUserId }: UnifiedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("week");

  const [showReservations, setShowReservations] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("08:00");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("10:00");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskDueTime, setNewTaskDueTime] = useState("09:00");
  const [newTaskViewerIds, setNewTaskViewerIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevWeek = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
  const nextWeek = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
  const prevDay = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
  const nextDay = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const allEvents: any[] = [];

  if (showReservations) {
    reservations.forEach(r => {
      allEvents.push({
        id: r.id,
        type: "reservation",
        title: `Reserva: ${r.vehicle.brand} ${r.vehicle.model} (${r.vehicle.plate})`,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        color: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
        raw: r
      });
    });
  }

  if (showOrders) {
    purchaseOrders.forEach(o => {
      if (o.deliveryDate) {
        allEvents.push({
          id: o.id,
          type: "order",
          title: `Entrega OC: N° ${o.number}`,
          startDate: new Date(o.deliveryDate),
          endDate: new Date(o.deliveryDate),
          color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
          raw: o
        });
      }
    });
  }

  if (showTasks) {
    tasks.forEach(t => {
      if (t.dueDate) {
        const isOwner = t.userId === currentUserId;
        const isAllowedViewer = t.viewerIds && t.viewerIds.split(",").map((s: string) => s.trim()).includes(currentUserId);

        if (isOwner || isAllowedViewer) {
          allEvents.push({
            id: t.id,
            type: "task",
            title: `Tarea: ${t.title}`,
            startDate: new Date(t.dueDate),
            endDate: new Date(t.dueDate),
            color: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
            raw: t,
            isOwner
          });
        }
      }
    });
  }

  const filteredEvents = allEvents.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.raw?.description && e.raw.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDays.push(d);
  }

  const handleDragStart = (e: React.DragEvent, eventItem: any) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: eventItem.id, type: eventItem.type }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = async (e: React.DragEvent, targetDate: Date, targetHour: number, targetMinute: number) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const { id, type } = JSON.parse(dataStr);

      const computedStart = new Date(targetDate);
      computedStart.setHours(targetHour, targetMinute, 0, 0);

      const toastId = toast.loading("Actualizando horario del evento...");
      let res;

      if (type === "task") {
        res = await rescheduleTaskAction(id, computedStart.toISOString());
      } else if (type === "order") {
        res = await reschedulePurchaseOrderAction(id, computedStart.toISOString());
      } else if (type === "reservation") {
        const computedEnd = new Date(computedStart);
        computedEnd.setHours(computedStart.getHours() + 2);
        res = await rescheduleReservationAction(id, computedStart.toISOString(), computedEnd.toISOString());
      }

      if (res?.success) {
        toast.success("Evento reprogramado con éxito", { id: toastId });
      } else {
        toast.error(res?.error || "Error al reprogramar el evento", { id: toastId });
      }
    } catch (err: any) {
      toast.error("Error al procesar el arrastre: " + err.message);
    }
  };

  const handleReschedule = async () => {
    if (!selectedEvent) return;
    setIsRescheduling(true);
    const toastId = toast.loading("Actualizando fecha del evento...");

    try {
      let res;
      const computedStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);

      if (selectedEvent.type === "task") {
        res = await rescheduleTaskAction(selectedEvent.id, computedStart.toISOString());
      } else if (selectedEvent.type === "reservation") {
        const computedEnd = new Date(`${rescheduleDate}T${rescheduleEndTime}:00`);
        res = await rescheduleReservationAction(selectedEvent.id, computedStart.toISOString(), computedEnd.toISOString());
      } else if (selectedEvent.type === "order") {
        res = await reschedulePurchaseOrderAction(selectedEvent.id, computedStart.toISOString());
      }

      if (res?.success) {
        toast.success("Fecha reprogramada con éxito", { id: toastId });
        setSelectedEvent(null);
      } else {
        toast.error(res?.error || "Error al reprogramar el evento", { id: toastId });
      }
    } catch (e: any) {
      toast.error(e.message || "Ocurrió un error inesperado", { id: toastId });
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) {
      toast.error("El título es obligatorio");
      return;
    }
    setIsSaving(true);
    const toastId = toast.loading("Registrando tarea compartida...");

    try {
      const viewerIdsStr = newTaskViewerIds.join(",");
      const computedDueDate = new Date(`${newTaskDueDate}T${newTaskDueTime}:00`);
      const res = await createSharedTaskAction(newTaskTitle, newTaskDesc, computedDueDate.toISOString(), viewerIdsStr);
      if (res.success) {
        toast.success("Tarea registrada y compartida correctamente", { id: toastId });
        setShowAddModal(false);
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskDueDate("");
        setNewTaskViewerIds([]);
      } else {
        toast.error(res.error || "Error al registrar la tarea", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Ocurrió un error inesperado", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewerToggle = (userId: string) => {
    if (newTaskViewerIds.includes(userId)) {
      setNewTaskViewerIds(newTaskViewerIds.filter(id => id !== userId));
    } else {
      setNewTaskViewerIds([...newTaskViewerIds, userId]);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      <div className="xl:col-span-1 space-y-6">
        <Card className="bg-card text-card-foreground border border-border/60 shadow-sm p-6 space-y-6 rounded-3xl">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Filtrar Agenda</h3>
            <Input
              placeholder="Buscar evento..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-muted/40 border-border/60 text-foreground rounded-xl text-xs"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Categorías de Logística</h4>
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-foreground select-none group">
                <input
                  type="checkbox"
                  checked={showReservations}
                  onChange={e => setShowReservations(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 border-border"
                />
                <span className="group-hover:text-primary transition-colors flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Reservas de Vehículos
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-foreground select-none group">
                <input
                  type="checkbox"
                  checked={showOrders}
                  onChange={e => setShowOrders(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-border"
                />
                <span className="group-hover:text-emerald-500 transition-colors flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Entregas de Órdenes
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-foreground select-none group">
                <input
                  type="checkbox"
                  checked={showTasks}
                  onChange={e => setShowTasks(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 border-border"
                />
                <span className="group-hover:text-amber-500 transition-colors flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Mis Tareas & Eventos
                </span>
              </label>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-[11px] text-primary font-bold space-y-1">
             <p className="uppercase tracking-widest text-primary">💡 Tip de Productividad</p>
             <p className="leading-relaxed opacity-90">¡Puedes arrastrar y soltar cualquier reserva o tarea a otra hora o día del calendario para reagendarla al instante!</p>
          </div>

          <div className="pt-4 border-t border-border/40">
             <Button
               onClick={() => setShowAddModal(true)}
               className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-2 font-bold text-xs uppercase tracking-wider h-11 shadow-md shadow-primary/20"
             >
                <Plus className="h-4 w-4" /> Nueva Tarea Compartida
             </Button>
          </div>
        </Card>
      </div>

      <div className="xl:col-span-3 space-y-6">
        <Card className="bg-card text-card-foreground border border-border/60 shadow-sm overflow-hidden rounded-[2rem]">
          <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="font-black text-xl text-foreground">
                {view === "month" && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                {view === "week" && `Semana del ${weekDays[0].getDate()} de ${monthNames[weekDays[0].getMonth()]}`}
                {view === "day" && `${currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
                {view === "agenda" && `Agenda General`}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-muted/60 p-0.5 rounded-2xl border border-border/40">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={view === "month" ? prevMonth : view === "week" ? prevWeek : view === "day" ? prevDay : prevWeek}
                  className="h-8 w-8 rounded-xl text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-foreground"
                >
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={view === "month" ? nextMonth : view === "week" ? nextWeek : view === "day" ? nextDay : nextWeek}
                  className="h-8 w-8 rounded-xl text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex bg-muted/60 p-0.5 rounded-2xl border border-border/40">
                <Button
                  onClick={() => setView("month")}
                  variant={view === "month" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 text-xs font-bold px-3 rounded-xl uppercase tracking-wider ${view === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Mes
                </Button>
                <Button
                  onClick={() => setView("week")}
                  variant={view === "week" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 text-xs font-bold px-3 rounded-xl uppercase tracking-wider ${view === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Semana
                </Button>
                <Button
                  onClick={() => setView("day")}
                  variant={view === "day" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 text-xs font-bold px-3 rounded-xl uppercase tracking-wider ${view === "day" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Día
                </Button>
                <Button
                  onClick={() => setView("agenda")}
                  variant={view === "agenda" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 text-xs font-bold px-3 rounded-xl uppercase tracking-wider ${view === "agenda" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Agenda
                </Button>
              </div>
            </div>
          </div>

          {view === "month" && (
            <div>
              <div className="grid grid-cols-7 text-center border-b border-border/40 bg-muted/30 py-2.5">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
                  <div key={day} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-b border-border/40">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-32 border-b border-r border-border/40 bg-muted/10" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                  const isToday = new Date().toDateString() === date.toDateString();

                  const dayEvents = filteredEvents.filter(e => {
                    const start = new Date(e.startDate);
                    start.setHours(0,0,0,0);
                    const end = new Date(e.endDate);
                    end.setHours(23,59,59,999);
                    return start <= date && end >= date;
                  });

                  return (
                    <div
                      key={d}
                      onDragOver={handleDragOver}
                      onDrop={(ev) => handleDropOnSlot(ev, date, 9, 0)}
                      className={`h-32 border-b border-r border-border/40 p-1.5 flex flex-col overflow-y-auto cursor-pointer relative group transition-colors hover:bg-muted/20 ${
                        isToday ? "bg-primary/10" : ""
                      }`}
                    >
                      <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center mb-1.5 ${
                        isToday ? "bg-primary text-primary-foreground font-black" : "text-muted-foreground"
                      }`}>
                        {d}
                      </span>

                      <div className="space-y-1">
                        {dayEvents.map(e => (
                          <div
                            key={e.id}
                            draggable
                            onDragStart={(ev) => handleDragStart(ev, e)}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setSelectedEvent(e);
                              setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                              setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                              if (e.type === "reservation") {
                                setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                              }
                            }}
                            className={`text-[9px] px-1.5 py-1 rounded-lg border font-bold truncate leading-tight shadow-xs cursor-grab active:cursor-grabbing transition-all hover:scale-102 ${e.color}`}
                            title={`${e.title} (${formatTime(e.startDate)})`}
                          >
                            <span className="opacity-75 font-mono mr-1">{formatTime(e.startDate)}</span>
                            {e.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-8 border-b border-border/40 bg-muted/30 py-3 text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border/40">Horario</div>
                  {weekDays.map((date, idx) => {
                    const isToday = new Date().toDateString() === date.toDateString();
                    return (
                      <div key={idx} className="flex flex-col items-center justify-center border-r border-border/40 last:border-r-0">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][idx]}
                        </span>
                        <span className={`text-sm font-black w-7 h-7 rounded-full flex items-center justify-center mt-1 ${
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                        }`}>
                          {date.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
                  {HOURS.map(hour => {
                    return [0, 30].map(minute => {
                      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

                      return (
                        <div key={timeStr} className="grid grid-cols-8 hover:bg-muted/20">
                          <div className="text-[10px] font-mono font-bold text-muted-foreground p-2 border-r border-border/40 flex items-center justify-center bg-muted/20 select-none">
                            {timeStr}
                          </div>

                          {weekDays.map((date, dayIdx) => {
                            const currentSlotStart = new Date(date);
                            currentSlotStart.setHours(hour, minute, 0, 0);
                            const currentSlotEnd = new Date(currentSlotStart);
                            currentSlotEnd.setMinutes(currentSlotStart.getMinutes() + 30);

                            const slotEvents = filteredEvents.filter(e => {
                              const start = new Date(e.startDate);
                              const end = new Date(e.endDate);
                              return (start < currentSlotEnd && end > currentSlotStart) ||
                                     (start.getTime() === currentSlotStart.getTime() && e.type !== "reservation");
                            });

                            return (
                              <div
                                key={dayIdx}
                                onDragOver={handleDragOver}
                                onDrop={(ev) => handleDropOnSlot(ev, date, hour, minute)}
                                className="border-r border-border/40 last:border-r-0 p-1.5 min-h-[44px] relative group flex flex-col gap-1 transition-all"
                              >
                                {slotEvents.map(e => {
                                  const isExactStart = new Date(e.startDate).getHours() === hour && new Date(e.startDate).getMinutes() === minute;
                                  return (
                                    <div
                                      key={e.id}
                                      draggable
                                      onDragStart={(ev) => handleDragStart(ev, e)}
                                      onClick={() => {
                                        setSelectedEvent(e);
                                        setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                                        setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                                        if (e.type === "reservation") {
                                          setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                                        }
                                      }}
                                      className={`p-1 px-2 rounded-lg border text-[9px] font-black leading-tight cursor-grab active:cursor-grabbing shadow-xs transition-transform hover:scale-102 ${e.color}`}
                                      title={`${e.title} (${formatTime(e.startDate)} - ${formatTime(e.endDate)})`}
                                    >
                                      {isExactStart && <span className="font-mono text-[8px] mr-1 opacity-75">{formatTime(e.startDate)}</span>}
                                      <span className="truncate block">{e.title}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>
          )}

          {view === "day" && (
            <div className="grid grid-cols-1 divide-y divide-border/20 max-h-[600px] overflow-y-auto">
              {HOURS.map(hour => {
                return [0, 30].map(minute => {
                  const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                  const currentSlotStart = new Date(currentDate);
                  currentSlotStart.setHours(hour, minute, 0, 0);
                  const currentSlotEnd = new Date(currentSlotStart);
                  currentSlotEnd.setMinutes(currentSlotStart.getMinutes() + 30);

                  const slotEvents = filteredEvents.filter(e => {
                    const start = new Date(e.startDate);
                    const end = new Date(e.endDate);
                    return (start < currentSlotEnd && end > currentSlotStart) ||
                           (start.getTime() === currentSlotStart.getTime() && e.type !== "reservation");
                  });

                  return (
                    <div
                      key={timeStr}
                      onDragOver={handleDragOver}
                      onDrop={(ev) => handleDropOnSlot(ev, currentDate, hour, minute)}
                      className="grid grid-cols-12 hover:bg-muted/20 min-h-[50px]"
                    >
                      <div className="col-span-2 text-xs font-mono font-bold text-muted-foreground p-3 border-r border-border/40 flex items-center justify-center bg-muted/20 select-none">
                        {timeStr}
                      </div>

                      <div className="col-span-10 p-2 flex flex-wrap gap-2 items-center">
                        {slotEvents.map(e => (
                          <div
                            key={e.id}
                            draggable
                            onDragStart={(ev) => handleDragStart(ev, e)}
                            onClick={() => {
                              setSelectedEvent(e);
                              setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                              setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                              if (e.type === "reservation") {
                                setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                              }
                            }}
                            className={`p-2 rounded-xl border text-[10px] font-black cursor-grab active:cursor-grabbing shadow-xs flex items-center gap-2 transition-transform hover:scale-102 ${e.color}`}
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            <span>
                              <span className="font-mono opacity-80 mr-1">{formatTime(e.startDate)} - {formatTime(e.endDate)}</span>
                              {e.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          )}

          {view === "agenda" && (
            <div className="divide-y divide-border/20 p-6">
              {filteredEvents.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground italic font-medium">
                  No hay eventos registrados para mostrar.
                </div>
              ) : (
                filteredEvents
                  .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                  .map(e => (
                    <div
                      key={e.id}
                      onClick={() => {
                        setSelectedEvent(e);
                        setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                        setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                        if (e.type === "reservation") {
                          setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                        }
                      }}
                      className="py-4 flex items-start md:items-center justify-between gap-4 group cursor-pointer hover:bg-muted/20 px-4 rounded-xl transition-all"
                    >
                      <div className="flex items-start md:items-center gap-4">
                        <div className="p-2 bg-muted rounded-xl text-center shrink-0 w-16 shadow-xs border border-border/40">
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                            {e.startDate.toLocaleDateString('es-AR', {weekday: 'short'})}
                          </p>
                          <p className="text-lg font-black text-foreground">
                            {e.startDate.getDate()}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                            {e.title}
                            <Badge className={`rounded-full px-2 py-0.5 text-[8px] font-black tracking-widest border-none ${e.color}`}>
                              {e.type === "reservation" ? "RESERVA" : e.type === "order" ? "ENTREGA OC" : "TAREA"}
                            </Badge>
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {e.raw?.description || e.raw?.reason || "Sin descripción disponible."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-muted-foreground flex items-center gap-1 uppercase tracking-wider italic">
                          <Clock className="h-3 w-3" />
                          {formatTime(e.startDate)}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </Card>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300">
          <Card className="w-full max-w-lg bg-card border border-border/60 shadow-xl p-6 space-y-6 relative rounded-3xl animate-in zoom-in-95 duration-200">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedEvent(null)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-black tracking-widest border-none w-fit ${selectedEvent.color}`}>
                {selectedEvent.type === "reservation" ? "RESERVA DE VEHÍCULO" : selectedEvent.type === "order" ? "ENTREGA DE ORDEN" : "TAREA ADMINISTRATIVA"}
              </Badge>
              <h3 className="text-xl font-black text-foreground tracking-tight">{selectedEvent.title}</h3>
            </div>

            <div className="bg-muted/40 rounded-2xl border border-border/40 p-4 space-y-3.5">
              {selectedEvent.type === "reservation" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Período: <span className="text-muted-foreground font-medium">{selectedEvent.startDate.toLocaleString('es-AR')} al {selectedEvent.endDate.toLocaleString('es-AR')}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <User className="h-4 w-4 text-blue-500" />
                    <span>Responsable: <span className="text-muted-foreground font-medium">{selectedEvent.raw.user.name}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    <span>Área: <span className="text-muted-foreground font-medium">{selectedEvent.raw.user.area?.name || "Sin Área"}</span></span>
                  </div>
                  {selectedEvent.raw.reason && (
                    <div className="pt-2 border-t border-border/20 text-xs text-muted-foreground italic font-medium">
                      Motivo: "{selectedEvent.raw.reason}"
                    </div>
                  )}
                </>
              )}

              {selectedEvent.type === "order" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <span>Entrega Pactada: <span className="text-muted-foreground font-medium">{selectedEvent.startDate.toLocaleString('es-AR')}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <User className="h-4 w-4 text-emerald-500" />
                    <span>Proveedor: <span className="text-muted-foreground font-medium">{selectedEvent.raw.providerName || "No registrado"}</span></span>
                  </div>
                  {selectedEvent.raw.providerCuit && (
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                      <Briefcase className="h-4 w-4 text-emerald-500" />
                      <span>CUIT: <span className="text-muted-foreground font-medium">{selectedEvent.raw.providerCuit}</span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                     <ShoppingBag className="h-4 w-4 text-emerald-500" />
                     <span>Importe total: <span className="text-emerald-500 font-bold">${Number(selectedEvent.raw.amount).toLocaleString('es-AR')}</span></span>
                  </div>
                </>
              )}

              {selectedEvent.type === "task" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span>Vencimiento: <span className="text-muted-foreground font-medium">{selectedEvent.startDate.toLocaleString('es-AR')}</span></span>
                  </div>
                  {selectedEvent.raw.description && (
                    <div className="pt-2 border-t border-border/20 text-xs text-muted-foreground italic font-medium">
                      Detalle: "{selectedEvent.raw.description}"
                    </div>
                  )}
                  {selectedEvent.raw.viewerIds && (
                    <div className="pt-2 border-t border-border/20 flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                       <Eye className="h-3 w-3 text-amber-500" /> Compartida con {selectedEvent.raw.viewerIds.split(',').length} agentes
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-border/20">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Edit2 className="h-3.5 w-3.5" /> Reprogramar Horarios de Logística
              </h4>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha</Label>
                    <Input
                      type="date"
                      value={rescheduleDate}
                      onChange={e => setRescheduleDate(e.target.value)}
                      className="bg-muted/40 border-border/60 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{selectedEvent.type === "reservation" ? "Hora Inicio" : "Hora"}</Label>
                    <Input
                      type="time"
                      value={rescheduleTime}
                      onChange={e => setRescheduleTime(e.target.value)}
                      className="bg-muted/40 border-border/60 rounded-xl text-xs"
                    />
                  </div>

                  {selectedEvent.type === "reservation" && (
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hora Fin</Label>
                      <Input
                        type="time"
                        value={rescheduleEndTime}
                        onChange={e => setRescheduleEndTime(e.target.value)}
                        className="bg-muted/40 border-border/60 rounded-xl text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-xl text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleReschedule}
                    disabled={isRescheduling}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 font-bold text-xs shadow-md"
                  >
                    {isRescheduling ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-start">
               <Link
                 href={
                   selectedEvent.type === "reservation" ? "/admin/vehicles" :
                   selectedEvent.type === "order" ? `/admin/purchase-orders/${selectedEvent.id}` :
                   "/tasks"
                 }
                 className="text-xs text-primary font-black uppercase tracking-wider hover:underline flex items-center gap-1"
               >
                  Ver detalle completo <ArrowRight className="h-3 w-3" />
               </Link>
            </div>
          </Card>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300">
          <Card className="w-full max-w-xl bg-card border border-border/60 shadow-xl p-6 space-y-6 relative rounded-3xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-foreground tracking-tight uppercase">Nueva Tarea Compartida</h3>
              <p className="text-sm text-muted-foreground font-medium">Cree tareas administrativas y elija qué agentes municipales pueden visualizarlas.</p>
            </div>

            <form onSubmit={handleAddTask} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Título de la Tarea</Label>
                <Input
                  id="title"
                  placeholder="Ej: Entrega de documentación de resmas"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  required
                  className="bg-muted/40 border-border/60 rounded-xl h-11 text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Descripción / Detalles</Label>
                <textarea
                  id="desc"
                  rows={2}
                  placeholder="Detalle los objetivos o motivo de la tarea..."
                  value={newTaskDesc}
                  onChange={e => setNewTaskDescription(e.target.value)}
                  className="flex min-h-[60px] w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fecha de Vencimiento</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    required
                    className="bg-muted/40 border-border/60 rounded-xl h-11 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueTime" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hora de Vencimiento</Label>
                  <Input
                    id="dueTime"
                    type="time"
                    value={newTaskDueTime}
                    onChange={e => setNewTaskDueTime(e.target.value)}
                    required
                    className="bg-muted/40 border-border/60 rounded-xl h-11 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <Eye className="h-4 w-4 text-amber-500" /> Invitar Agentes a Ver esta Tarea
                </Label>

                <div className="border border-border/40 rounded-xl p-3.5 max-h-40 overflow-y-auto bg-muted/30 space-y-2">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-3 cursor-pointer text-xs font-bold select-none group text-foreground">
                      <input
                        type="checkbox"
                        checked={newTaskViewerIds.includes(u.id)}
                        onChange={() => handleViewerToggle(u.id)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4.5 w-4.5 border-border"
                      />
                      <span className="group-hover:text-primary transition-colors flex items-center gap-2">
                         <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-[10px] uppercase">
                           {u.name?.[0]}
                         </div>
                         {u.name} <span className="text-[10px] text-muted-foreground font-medium italic">({u.area?.name || "Sin Área"})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 font-bold text-xs shadow-md"
                >
                  {isSaving ? "Creando..." : "Crear y Compartir"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
