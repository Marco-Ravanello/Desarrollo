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

type CalendarViewType = "month" | "week" | "agenda";

export function UnifiedCalendar({ reservations, purchaseOrders, tasks, users, currentUserId }: UnifiedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");

  // Filtering States
  const [showReservations, setShowReservations] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleEndDate, setRescheduleEndDate] = useState(""); // For reservations only

  // Add Task Form States
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskViewerIds, setNewTaskViewerIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Month navigation helpers
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevWeek = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
  const nextWeek = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Normalize all calendar items
  const allEvents: any[] = [];

  // 1. Add Vehicle Reservations
  if (showReservations) {
    reservations.forEach(r => {
      allEvents.push({
        id: r.id,
        type: "reservation",
        title: `Reserva: ${r.vehicle.brand} ${r.vehicle.model} (${r.vehicle.plate})`,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        color: "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
        raw: r
      });
    });
  }

  // 2. Add Purchase Order Deliveries
  if (showOrders) {
    purchaseOrders.forEach(o => {
      if (o.deliveryDate) {
        allEvents.push({
          id: o.id,
          type: "order",
          title: `Entrega OC: N° ${o.number}`,
          startDate: new Date(o.deliveryDate),
          endDate: new Date(o.deliveryDate),
          color: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
          raw: o
        });
      }
    });
  }

  // 3. Add Tasks with Shared Visibility Filter
  if (showTasks) {
    tasks.forEach(t => {
      if (t.dueDate) {
        // Shared visibility filter: User is creator OR user's ID is in viewerIds JSON array / comma-separated string
        const isOwner = t.userId === currentUserId;
        const isAllowedViewer = t.viewerIds && t.viewerIds.split(",").map((s: string) => s.trim()).includes(currentUserId);

        if (isOwner || isAllowedViewer) {
          allEvents.push({
            id: t.id,
            type: "task",
            title: `Tarea: ${t.title}`,
            startDate: new Date(t.dueDate),
            endDate: new Date(t.dueDate),
            color: "bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
            raw: t,
            isOwner
          });
        }
      }
    });
  }

  // Filter events based on search query
  const filteredEvents = allEvents.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.raw?.description && e.raw.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Month Grid Calculations
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  // Week Grid Calculations
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  startOfWeek.setDate(diff);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDays.push(d);
  }

  // Handle Rescheduling Submission
  const handleReschedule = async () => {
    if (!selectedEvent) return;
    setIsRescheduling(true);
    const toastId = toast.loading("Actualizando fecha del evento...");

    try {
      let res;
      if (selectedEvent.type === "task") {
        res = await rescheduleTaskAction(selectedEvent.id, rescheduleDate);
      } else if (selectedEvent.type === "reservation") {
        res = await rescheduleReservationAction(selectedEvent.id, rescheduleDate, rescheduleEndDate);
      } else if (selectedEvent.type === "order") {
        res = await reschedulePurchaseOrderAction(selectedEvent.id, rescheduleDate);
      }

      if (res?.success) {
        toast.success("Fecha reprogramada con éxito", { id: toastId });
        // Refresh local cache/state
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

  // Handle Add Task Submission
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
      const res = await createSharedTaskAction(newTaskTitle, newTaskDesc, newTaskDueDate, viewerIdsStr);
      if (res.success) {
        toast.success("Tarea registrada y compartida correctamente", { id: toastId });
        setShowAddModal(false);
        // Reset fields
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      {/* Filters Sidebar */}
      <div className="xl:col-span-1 space-y-6">
        <Card className="bg-white/75 dark:bg-card/75 backdrop-blur-md border border-border/40 shadow-municipal p-6 space-y-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Filtrar Agenda</h3>
            <Input
              placeholder="Buscar evento..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-50/50 dark:bg-slate-900/30 rounded-xl"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Categorías de Logística</h4>
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold select-none group">
                <input
                  type="checkbox"
                  checked={showReservations}
                  onChange={e => setShowReservations(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
                />
                <span className="group-hover:text-blue-500 transition-colors flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Reservas de Vehículos
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold select-none group">
                <input
                  type="checkbox"
                  checked={showOrders}
                  onChange={e => setShowOrders(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
                />
                <span className="group-hover:text-emerald-500 transition-colors flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Entregas de Órdenes
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold select-none group">
                <input
                  type="checkbox"
                  checked={showTasks}
                  onChange={e => setShowTasks(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 border-slate-300"
                />
                <span className="group-hover:text-amber-500 transition-colors flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Mis Tareas & Eventos
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40">
             <Button
               onClick={() => setShowAddModal(true)}
               className="w-full bg-[#004a80] hover:bg-[#00365d] text-white rounded-xl gap-2 font-bold shadow-lg shadow-blue-500/10"
             >
                <Plus className="h-4 w-4" /> Nueva Tarea Compartida
             </Button>
          </div>
        </Card>
      </div>

      {/* Main Calendar Space */}
      <div className="xl:col-span-3 space-y-6">
        <Card className="bg-white/75 dark:bg-card/75 backdrop-blur-md border border-border/40 shadow-municipal overflow-hidden">
          {/* Calendar Header Controls */}
          <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/40 dark:bg-slate-900/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="font-black text-xl text-foreground">
                {view === "month" && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                {view === "week" && `Semana de ${weekDays[0].toLocaleDateString('es-AR', {day: 'numeric', month: 'short'})}`}
                {view === "agenda" && `Agenda General`}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Navigation Arrows */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-border/30">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={view === "month" ? prevMonth : prevWeek}
                  className="h-8 w-8 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={view === "month" ? nextMonth : nextWeek}
                  className="h-8 w-8 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* View Switches */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-border/30">
                <Button
                  onClick={() => setView("month")}
                  variant={view === "month" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 text-xs font-bold px-3 rounded-lg uppercase tracking-wider ${view === "month" ? "bg-white dark:bg-card shadow-sm" : ""}`}
                >
                  Mes
                </Button>
                <Button
                  onClick={() => setView("week")}
                  variant={view === "week" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 text-xs font-bold px-3 rounded-lg uppercase tracking-wider ${view === "week" ? "bg-white dark:bg-card shadow-sm" : ""}`}
                >
                  Semana
                </Button>
                <Button
                  onClick={() => setView("agenda")}
                  variant={view === "agenda" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 text-xs font-bold px-3 rounded-lg uppercase tracking-wider ${view === "agenda" ? "bg-white dark:bg-card shadow-sm" : ""}`}
                >
                  Agenda
                </Button>
              </div>
            </div>
          </div>

          {/* Month View Grid */}
          {view === "month" && (
            <div>
              <div className="grid grid-cols-7 text-center border-b border-border/30 bg-slate-50/10 py-2.5">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
                  <div key={day} className="text-[10px] font-black uppercase tracking-widest text-slate-400">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-b border-border/30">
                {/* Empty starting cells */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-32 border-b border-r border-border/30 bg-slate-50/10 dark:bg-slate-900/5" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                  const isToday = new Date().toDateString() === date.toDateString();

                  // Find events for this specific day
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
                      onClick={() => {
                        if (dayEvents.length > 0) {
                          setSelectedEvent(dayEvents[0]);
                          setRescheduleDate(dayEvents[0].startDate.toISOString().split("T")[0]);
                          if (dayEvents[0].type === "reservation") {
                            setRescheduleEndDate(dayEvents[0].endDate.toISOString().split("T")[0]);
                          }
                        }
                      }}
                      className={`h-32 border-b border-r border-border/30 p-1.5 flex flex-col overflow-y-auto cursor-pointer relative group transition-colors hover:bg-slate-50/30 dark:hover:bg-slate-900/10 ${
                        isToday ? "bg-blue-50/20 dark:bg-blue-950/10" : ""
                      }`}
                    >
                      <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center mb-1.5 ${
                        isToday ? "bg-primary text-white font-black" : "text-slate-400"
                      }`}>
                        {d}
                      </span>

                      <div className="space-y-1">
                        {dayEvents.map(e => (
                          <div
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setSelectedEvent(e);
                              setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                              if (e.type === "reservation") {
                                setRescheduleEndDate(e.endDate.toISOString().split("T")[0]);
                              }
                            }}
                            className={`text-[9px] px-1.5 py-1 rounded-lg border font-bold truncate leading-tight shadow-sm transition-all hover:scale-102 ${e.color}`}
                            title={e.title}
                          >
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

          {/* Week View Grid */}
          {view === "week" && (
            <div className="grid grid-cols-7 border-b border-border/30">
              {weekDays.map((date, i) => {
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
                    key={i}
                    className={`min-h-[400px] border-r border-border/30 p-3 flex flex-col gap-2 ${
                      isToday ? "bg-blue-50/15 dark:bg-blue-950/5" : ""
                    }`}
                  >
                    <div className="text-center pb-2 border-b border-border/20">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i]}
                      </p>
                      <p className={`text-lg font-black w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-1 ${
                        isToday ? "bg-primary text-white" : "text-foreground"
                      }`}>
                        {date.getDate()}
                      </p>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto">
                      {dayEvents.map(e => (
                        <div
                          key={e.id}
                          onClick={() => {
                            setSelectedEvent(e);
                            setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                            if (e.type === "reservation") {
                              setRescheduleEndDate(e.endDate.toISOString().split("T")[0]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border font-bold text-[10px] leading-snug cursor-pointer shadow-sm transition-all hover:scale-102 ${e.color}`}
                        >
                          <div className="truncate mb-1">{e.title}</div>
                          <div className="flex items-center gap-1 opacity-70 text-[8px] font-black uppercase tracking-wider">
                            <Clock className="h-2.5 w-2.5" />
                            {e.type === "reservation" ? "Reserva" : e.type === "order" ? "Entrega OC" : "Tarea"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Agenda / List View */}
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
                        if (e.type === "reservation") {
                          setRescheduleEndDate(e.endDate.toISOString().split("T")[0]);
                        }
                      }}
                      className="py-4 flex items-start md:items-center justify-between gap-4 group cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10 px-4 rounded-xl transition-all"
                    >
                      <div className="flex items-start md:items-center gap-4">
                        {/* Event Date Block */}
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-center shrink-0 w-16 shadow-inner">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {e.startDate.toLocaleDateString('es-AR', {weekday: 'short'})}
                          </p>
                          <p className="text-lg font-black text-foreground">
                            {e.startDate.getDate()}
                          </p>
                        </div>

                        {/* Title & Description */}
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
                        <span className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-wider italic">
                          <Clock className="h-3 w-3" />
                          {e.startDate.toLocaleDateString('es-AR', {month: 'long', year: 'numeric'})}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Floating Modal (Glassmorphic Dialog) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300">
          <Card className="w-full max-w-lg bg-white/90 dark:bg-[#131B2E]/95 backdrop-blur-md border border-border/40 shadow-municipal-lg p-6 space-y-6 relative rounded-3xl animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedEvent(null)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Header info */}
            <div className="space-y-2">
              <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-black tracking-widest border-none w-fit ${selectedEvent.color}`}>
                {selectedEvent.type === "reservation" ? "RESERVA DE VEHÍCULO" : selectedEvent.type === "order" ? "ENTREGA DE ORDEN" : "TAREA ADMINISTRATIVA"}
              </Badge>
              <h3 className="text-xl font-black text-foreground tracking-tight">{selectedEvent.title}</h3>
            </div>

            {/* Event detail card */}
            <div className="bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border p-4 space-y-3.5">
              {selectedEvent.type === "reservation" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Período: <span className="text-muted-foreground font-medium">{selectedEvent.startDate.toLocaleDateString('es-AR')} al {selectedEvent.endDate.toLocaleDateString('es-AR')}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold">
                    <User className="h-4 w-4 text-blue-500" />
                    <span>Responsable: <span className="text-muted-foreground font-medium">{selectedEvent.raw.user.name}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold">
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
                  <div className="flex items-center gap-2.5 text-sm font-semibold">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <span>Entrega Pactada: <span className="text-muted-foreground font-medium">{selectedEvent.startDate.toLocaleDateString('es-AR')}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold">
                    <User className="h-4 w-4 text-emerald-500" />
                    <span>Proveedor: <span className="text-muted-foreground font-medium">{selectedEvent.raw.providerName || "No registrado"}</span></span>
                  </div>
                  {selectedEvent.raw.providerCuit && (
                    <div className="flex items-center gap-2.5 text-sm font-semibold">
                      <Briefcase className="h-4 w-4 text-emerald-500" />
                      <span>CUIT: <span className="text-muted-foreground font-medium">{selectedEvent.raw.providerCuit}</span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-sm font-semibold">
                     <ShoppingBag className="h-4 w-4 text-emerald-500" />
                     <span>Importe total: <span className="text-emerald-600 font-bold">${Number(selectedEvent.raw.amount).toLocaleString('es-AR')}</span></span>
                  </div>
                </>
              )}

              {selectedEvent.type === "task" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span>Vencimiento: <span className="text-muted-foreground font-medium">{selectedEvent.startDate.toLocaleDateString('es-AR')}</span></span>
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

            {/* Rescheduling Form */}
            <div className="space-y-4 pt-4 border-t border-border/20">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Edit2 className="h-3.5 w-3.5" /> Reprogramar Fecha de Logística
              </h4>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">{selectedEvent.type === "reservation" ? "Fecha Inicio" : "Nueva Fecha"}</Label>
                    <Input
                      type="date"
                      value={rescheduleDate}
                      onChange={e => setRescheduleDate(e.target.value)}
                      className="bg-slate-50/50 dark:bg-slate-900/30 rounded-xl"
                    />
                  </div>

                  {selectedEvent.type === "reservation" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider">Fecha Fin</Label>
                      <Input
                        type="date"
                        value={rescheduleEndDate}
                        onChange={e => setRescheduleEndDate(e.target.value)}
                        className="bg-slate-50/50 dark:bg-slate-900/30 rounded-xl"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleReschedule}
                    disabled={isRescheduling}
                    className="bg-[#004a80] hover:bg-[#00365d] text-white rounded-xl gap-2 font-bold shadow-lg"
                  >
                    {isRescheduling ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              </div>
            </div>

            {/* View Full Link */}
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

      {/* Floating Add Shared Task Modal (Glassmorphic Dialog) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300">
          <Card className="w-full max-w-xl bg-white/90 dark:bg-[#131B2E]/95 backdrop-blur-md border border-border/40 shadow-municipal-lg p-6 space-y-6 relative rounded-3xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-foreground tracking-tight uppercase tracking-tighter">Nueva Tarea Compartida</h3>
              <p className="text-sm text-muted-foreground font-medium">Cree tareas administrativas y elija qué agentes municipales pueden visualizarlas.</p>
            </div>

            <form onSubmit={handleAddTask} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold uppercase tracking-widest text-slate-400">Título de la Tarea</Label>
                <Input
                  id="title"
                  placeholder="Ej: Entrega de documentación de resmas"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  required
                  className="bg-slate-50/50 dark:bg-slate-900/30 rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc" className="text-xs font-bold uppercase tracking-widest text-slate-400">Descripción / Detalles</Label>
                <textarea
                  id="desc"
                  rows={2}
                  placeholder="Detalle los objetivos o motivo de la tarea..."
                  value={newTaskDesc}
                  onChange={e => setNewTaskDescription(e.target.value)}
                  className="flex min-h-[60px] w-full rounded-xl border border-input bg-slate-50/50 dark:bg-slate-900/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-xs font-bold uppercase tracking-widest text-slate-400">Fecha de Vencimiento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newTaskDueDate}
                  onChange={e => setNewTaskDueDate(e.target.value)}
                  required
                  className="bg-slate-50/50 dark:bg-slate-900/30 rounded-xl h-11"
                />
              </div>

              {/* Shared Visibility Invites Checklist */}
              <div className="space-y-3.5 pt-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <Eye className="h-4 w-4 text-amber-500" /> Invitar Agentes a Ver esta Tarea
                </Label>

                <div className="border border-border/30 rounded-xl p-3.5 max-h-40 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-3 cursor-pointer text-xs font-bold select-none group">
                      <input
                        type="checkbox"
                        checked={newTaskViewerIds.includes(u.id)}
                        onChange={() => handleViewerToggle(u.id)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4.5 w-4.5 border-slate-300"
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
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#004a80] hover:bg-[#00365d] text-white rounded-xl gap-2 font-bold shadow-lg"
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
