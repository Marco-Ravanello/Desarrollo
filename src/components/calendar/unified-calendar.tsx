"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Calendar, User, Briefcase,
  Clock, CheckSquare, ShoppingBag, Plus, X, Globe, Eye,
  Edit2, Save, Trash2, ArrowRight, Car, MapPin, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyMessage } from "@/components/ui/empty-message";
import { toast } from "sonner";
import Link from "next/link";
import {
  rescheduleTaskAction,
  rescheduleReservationAction,
  reschedulePurchaseOrderAction,
  createSharedTaskAction
} from "@/app/(dashboard)/admin/actions/calendar-actions";
import { formatFechaHora, formatHora } from "@/lib/fechas";

interface UnifiedCalendarProps {
  reservations: any[];
  purchaseOrders: any[];
  tasks: any[];
  users: any[];
  currentUserId: string;
}

type CalendarViewType = "month" | "week" | "day" | "agenda";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

export function UnifiedCalendar({ reservations = [], purchaseOrders = [], tasks = [], users = [], currentUserId }: UnifiedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
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

  const [nowClock, setNowClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevWeek = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
  const nextWeek = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
  const prevDay = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
  const nextDay = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const allEvents: any[] = [];

  if (showReservations && Array.isArray(reservations)) {
    reservations.forEach((r) => {
      if (!r) return;
      const brand = r.vehicle?.brand || "Vehículo";
      const model = r.vehicle?.model || "Oficial";
      const plate = r.vehicle?.plate || "S/P";

      allEvents.push({
        id: r.id,
        type: "reservation",
        title: `Reserva: ${brand} ${model} (${plate})`,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-l-4 border-l-blue-500 border-border/40 hover:bg-blue-500/20",
        badgeBg: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
        icon: Car,
        raw: r
      });
    });
  }

  if (showOrders && Array.isArray(purchaseOrders)) {
    purchaseOrders.forEach((o) => {
      if (o && o.deliveryDate) {
        allEvents.push({
          id: o.id,
          type: "order",
          title: `Entrega OC: N° ${o.number || "S/N"}`,
          startDate: new Date(o.deliveryDate),
          endDate: new Date(o.deliveryDate),
          color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-l-4 border-l-emerald-500 border-border/40 hover:bg-emerald-500/20",
          badgeBg: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
          icon: ShoppingBag,
          raw: o
        });
      }
    });
  }

  if (showTasks && Array.isArray(tasks)) {
    tasks.forEach((t) => {
      if (t && t.dueDate) {
        const isOwner = t.userId === currentUserId;
        const isAllowedViewer = t.viewerIds && t.viewerIds.split(",").map((s: string) => s.trim()).includes(currentUserId);

        if (isOwner || isAllowedViewer) {
          allEvents.push({
            id: t.id,
            type: "task",
            title: `Tarea: ${t.title || "Sin título"}`,
            startDate: new Date(t.dueDate),
            endDate: new Date(t.dueDate),
            color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-l-4 border-l-amber-500 border-border/40 hover:bg-amber-500/20",
            badgeBg: "bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500/30",
            icon: CheckSquare,
            raw: t,
            isOwner
          });
        }
      }
    });
  }

  const filteredEvents = allEvents.filter((e) =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.raw?.description && e.raw.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);

  const weekDays: Date[] = [];
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
        // Se mueve con la misma duración que tenía.
        const original = reservations.find((r) => r?.id === id);
        const duration = original ? new Date(original.endDate).getTime() - new Date(original.startDate).getTime() : 2 * 3600000;
        const computedEnd = new Date(computedStart.getTime() + Math.max(duration, 15 * 60000));
        res = await rescheduleReservationAction(id, computedStart.toISOString(), computedEnd.toISOString());
      }

      if (res?.success) {
        toast.success(
          res && "backToPending" in res && res.backToPending ? "Reserva movida. Vuelve a quedar pendiente de aprobación." : "Evento reprogramado con éxito",
          { id: toastId }
        );
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
        toast.success(
          res && "backToPending" in res && res.backToPending ? "Reserva movida. Vuelve a quedar pendiente de aprobación." : "Fecha reprogramada con éxito",
          { id: toastId }
        );
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
      setNewTaskViewerIds(newTaskViewerIds.filter((id) => id !== userId));
    } else {
      setNewTaskViewerIds([...newTaskViewerIds, userId]);
    }
  };

  const formatTime = (date: Date) => {
    return formatHora(date);
  };

  // Mini Calendar Calculations
  const miniDaysInMonth = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 0).getDate();
  const miniFirstDay = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth(), 1).getDay();

  const datesWithEventsSet = useMemo(() => {
    const dates = new Set<string>();
    allEvents.forEach((e) => {
      const key = `${e.startDate.getFullYear()}-${e.startDate.getMonth()}-${e.startDate.getDate()}`;
      dates.add(key);
    });
    return dates;
  }, [allEvents]);

  // Current Time Line percentage calculation (7:00 to 22:00)
  const isTodayWeek = weekDays.some((d) => d.toDateString() === nowClock.toDateString());
  const nowHours = nowClock.getHours();
  const nowMinutes = nowClock.getMinutes();
  const showTimeLine = isTodayWeek && nowHours >= 7 && nowHours < 22;
  const timeLineMinutesFrom7 = (nowHours - 7) * 60 + nowMinutes;
  const totalMinutesInGrid = 15 * 60; // 15 hours * 60 = 900 mins
  const timeLinePercentage = (timeLineMinutesFrom7 / totalMinutesInGrid) * 100;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[17rem_minmax(0,1fr)] gap-6">
      <div className="space-y-6 min-w-0">
        <Card className="bg-card text-card-foreground border border-border/60 shadow-xs p-5 space-y-5 rounded-2xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {monthNames[miniCalMonth.getMonth()]} {miniCalMonth.getFullYear()}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() - 1, 1))}
                  aria-label="Mes anterior"
                  className="h-7 w-7 rounded-xl text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMiniCalMonth(new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 1))}
                  aria-label="Mes siguiente"
                  className="h-7 w-7 rounded-xl text-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground py-1 border-b border-border/30">
              {["D", "L", "M", "M", "J", "V", "S"].map((d, idx) => (
                <span key={idx}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 text-center gap-y-1 text-xs">
              {Array.from({ length: miniFirstDay }).map((_, i) => (
                <div key={`mini-empty-${i}`} className="h-7" />
              ))}

              {Array.from({ length: miniDaysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const testDate = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth(), dayNum);
                const isSelected = currentDate.toDateString() === testDate.toDateString();
                const isToday = new Date().toDateString() === testDate.toDateString();
                const eventKey = `${testDate.getFullYear()}-${testDate.getMonth()}-${testDate.getDate()}`;
                const hasEvent = datesWithEventsSet.has(eventKey);

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => {
                      setCurrentDate(testDate);
                      setView("day");
                    }}
                    className={`h-7 w-7 mx-auto rounded-xl font-bold flex flex-col items-center justify-center relative transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : isToday
                        ? "border border-primary text-primary font-bold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span>{dayNum}</span>
                    {hasEvent && !isSelected && (
                      <span className="w-1 h-1 rounded-full bg-primary absolute bottom-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-border/40">
            <Input
              placeholder="Buscar en la agenda"
              aria-label="Buscar en la agenda"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/30 border-border/60 text-foreground rounded-xl text-xs h-9"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground">
              Capas de actividad operativa
            </span>

            <div className="grid grid-cols-1 gap-2.5">
              <div
                onClick={() => setShowReservations(!showReservations)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  showReservations
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400 shadow-2xs"
                    : "bg-muted/20 border-border/40 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/20">
                    <Car className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Flota & Vehículos</p>
                    <p className="text-xs text-muted-foreground">Reservas activas</p>
                  </div>
                </div>
                <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-none font-bold text-xs">
                  {reservations.length}
                </Badge>
              </div>

              <div
                onClick={() => setShowOrders(!showOrders)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  showOrders
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-2xs"
                    : "bg-muted/20 border-border/40 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Entregas & Depósito</p>
                    <p className="text-xs text-muted-foreground">Órdenes pactadas</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-none font-bold text-xs">
                  {purchaseOrders.length}
                </Badge>
              </div>

              <div
                onClick={() => setShowTasks(!showTasks)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  showTasks
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-2xs"
                    : "bg-muted/20 border-border/40 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Tareas & Alertas</p>
                    <p className="text-xs text-muted-foreground">Compromisos compartidos</p>
                  </div>
                </div>
                <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-400 border-none font-bold text-xs">
                  {tasks.length}
                </Badge>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40">
            <Button
              onClick={() => setShowAddModal(true)}
              className="w-full h-auto min-h-11 whitespace-normal rounded-2xl gap-2 font-bold text-sm shadow-sm"
            >
              <Plus className="h-4 w-4 shrink-0" /> Nueva tarea compartida
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-6 min-w-0">
        <Card className="bg-card text-card-foreground border border-border/60 shadow-xs overflow-hidden rounded-2xl">
          <div className="p-5 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-xl text-foreground">
                {view === "month" && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                {view === "week" && `Semana del ${weekDays[0].getDate()} de ${monthNames[weekDays[0].getMonth()].toLowerCase()}`}
                {view === "day" && `${currentDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
                {view === "agenda" && `Agenda general`}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/40">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={view === "month" ? prevMonth : view === "week" ? prevWeek : view === "day" ? prevDay : prevWeek}
                  aria-label="Anterior"
                  className="h-8 w-8 rounded-xl text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="h-8 px-3 rounded-xl text-xs font-bold text-foreground"
                >
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={view === "month" ? nextMonth : view === "week" ? nextWeek : view === "day" ? nextDay : nextWeek}
                  aria-label="Siguiente"
                  className="h-8 w-8 rounded-xl text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex bg-muted/60 p-1 rounded-2xl border border-border/40">
                {(["month", "week", "day", "agenda"] as CalendarViewType[]).map((v) => (
                  <Button
                    key={v}
                    onClick={() => setView(v)}
                    variant={view === v ? "secondary" : "ghost"}
                    size="sm"
                    className={`h-8 text-xs font-bold px-3 rounded-xl ${
                      view === v ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    {v === "month" ? "Mes" : v === "week" ? "Semana" : v === "day" ? "Día" : "Agenda"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {view === "month" && (
            <div>
              <div className="grid grid-cols-7 text-center border-b border-border/40 bg-muted/30 py-2.5">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
                  <div key={day} className="text-xs font-bold text-muted-foreground">
                    {day}
                  </div>
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

                  const dayEvents = filteredEvents.filter((e) => {
                    const start = new Date(e.startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(e.endDate);
                    end.setHours(23, 59, 59, 999);
                    return start <= date && end >= date;
                  });

                  return (
                    <div
                      key={d}
                      onDragOver={handleDragOver}
                      onDrop={(ev) => handleDropOnSlot(ev, date, 9, 0)}
                      className={`h-32 border-b border-r border-border/40 p-1.5 flex flex-col overflow-y-auto cursor-pointer relative group transition-colors hover:bg-muted/20 ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                    >
                      <span
                        className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center mb-1.5 ${
                          isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {d}
                      </span>

                      <div className="space-y-1">
                        {dayEvents.map((e) => {
                          const IconComp = e.icon;
                          return (
                            <div
                              key={e.id}
                              draggable
                              onDragStart={(ev) => handleDragStart(ev, e)}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setSelectedEvent(e);
                                setSearchQuery("");
                                setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                                setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                                if (e.type === "reservation") {
                                  setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                                }
                              }}
                              className={`text-xs px-1.5 py-1 rounded-lg border font-bold truncate leading-tight shadow-2xs cursor-grab active:cursor-grabbing transition-all hover:scale-102 flex items-center gap-1 ${e.color}`}
                              title={`${e.title} (${formatTime(e.startDate)})`}
                            >
                              <IconComp className="h-3 w-3 shrink-0" />
                              <span className="truncate">{e.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[640px] relative">
                <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border/40 bg-muted/30 py-3 text-center">
                  <div className="text-xs font-bold text-muted-foreground border-r border-border/40">
                    Horario
                  </div>
                  {weekDays.map((date, idx) => {
                    const isToday = new Date().toDateString() === date.toDateString();
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col items-center justify-center border-r border-border/40 last:border-r-0 py-1 ${
                          isToday ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-muted-foreground">
                            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][idx]}
                          </span>
                          {isToday && (
                            <Badge className="bg-primary text-primary-foreground text-xs font-bold px-1 py-0 h-3.5">
                              Hoy
                            </Badge>
                          )}
                        </div>
                        <span
                          className={`text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center mt-1 ${
                            isToday ? "bg-primary text-primary-foreground shadow-xs" : "text-foreground"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="divide-y divide-border/20 max-h-[620px] overflow-y-auto custom-scrollbar relative">
                  {showTimeLine && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                      style={{ top: `${timeLinePercentage}%` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute -left-1" />
                      <div className="w-full border-b-2 border-rose-500 shadow-sm" />
                    </div>
                  )}

                  {HOURS.map((hour) => {
                    return [0, 30].map((minute) => {
                      const isFullHour = minute === 0;
                      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

                      return (
                        <div
                          key={timeStr}
                          className={`grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] hover:bg-muted/20 ${
                            isFullHour ? "border-b border-border/40" : "border-b border-dashed border-border/20"
                          }`}
                        >
                          <div className="text-xs font-mono font-bold text-muted-foreground p-1.5 border-r border-border/40 flex items-center justify-center bg-muted/20 select-none">
                            {timeStr}
                          </div>

                          {weekDays.map((date, dayIdx) => {
                            const isToday = new Date().toDateString() === date.toDateString();
                            const currentSlotStart = new Date(date);
                            currentSlotStart.setHours(hour, minute, 0, 0);
                            const currentSlotEnd = new Date(currentSlotStart);
                            currentSlotEnd.setMinutes(currentSlotStart.getMinutes() + 30);

                            const slotEvents = filteredEvents.filter((e) => {
                              const start = new Date(e.startDate);
                              const end = new Date(e.endDate);
                              return (
                                (start < currentSlotEnd && end > currentSlotStart) ||
                                (start.getTime() === currentSlotStart.getTime() && e.type !== "reservation")
                              );
                            });

                            return (
                              <div
                                key={dayIdx}
                                onDragOver={handleDragOver}
                                onDrop={(ev) => handleDropOnSlot(ev, date, hour, minute)}
                                className={`border-r border-border/40 last:border-r-0 p-1 min-h-[42px] relative group flex flex-col gap-1 transition-all ${
                                  isToday ? "bg-primary/5" : ""
                                }`}
                              >
                                {slotEvents.map((e) => {
                                  const IconComp = e.icon;
                                  return (
                                    <div
                                      key={e.id}
                                      draggable
                                      onDragStart={(ev) => handleDragStart(ev, e)}
                                      onClick={() => {
                                        setSelectedEvent(e);
                                        setSearchQuery("");
                                        setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                                        setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                                        if (e.type === "reservation") {
                                          setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                                        }
                                      }}
                                      className={`p-1.5 rounded-xl text-xs font-bold leading-tight cursor-grab active:cursor-grabbing shadow-2xs transition-all hover:scale-102 hover:shadow-xs flex items-center justify-between gap-1 ${e.color}`}
                                      title={`${e.title} (${formatTime(e.startDate)} - ${formatTime(e.endDate)})`}
                                    >
                                      <div className="flex items-center gap-1 min-w-0">
                                        <IconComp className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{e.title}</span>
                                      </div>
                                      <Badge variant="outline" className={`text-xs font-mono px-1 py-0 h-3.5 border-none font-bold ${e.badgeBg}`}>
                                        {formatTime(e.startDate)}
                                      </Badge>
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
            <div className="grid grid-cols-1 divide-y divide-border/20 max-h-[620px] overflow-y-auto custom-scrollbar">
              {HOURS.map((hour) => {
                return [0, 30].map((minute) => {
                  const isFullHour = minute === 0;
                  const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                  const currentSlotStart = new Date(currentDate);
                  currentSlotStart.setHours(hour, minute, 0, 0);
                  const currentSlotEnd = new Date(currentSlotStart);
                  currentSlotEnd.setMinutes(currentSlotStart.getMinutes() + 30);

                  const slotEvents = filteredEvents.filter((e) => {
                    const start = new Date(e.startDate);
                    const end = new Date(e.endDate);
                    return (
                      (start < currentSlotEnd && end > currentSlotStart) ||
                      (start.getTime() === currentSlotStart.getTime() && e.type !== "reservation")
                    );
                  });

                  return (
                    <div
                      key={timeStr}
                      onDragOver={handleDragOver}
                      onDrop={(ev) => handleDropOnSlot(ev, currentDate, hour, minute)}
                      className={`grid grid-cols-12 hover:bg-muted/20 min-h-[50px] ${
                        isFullHour ? "border-b border-border/40" : "border-b border-dashed border-border/20"
                      }`}
                    >
                      <div className="col-span-2 text-xs font-mono font-bold text-muted-foreground p-3 border-r border-border/40 flex items-center justify-center bg-muted/20 select-none">
                        {timeStr}
                      </div>

                      <div className="col-span-10 p-2 flex flex-wrap gap-2 items-center">
                        {slotEvents.map((e) => {
                          const IconComp = e.icon;
                          return (
                            <div
                              key={e.id}
                              draggable
                              onDragStart={(ev) => handleDragStart(ev, e)}
                              onClick={() => {
                                setSelectedEvent(e);
                                setSearchQuery("");
                                setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                                setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                                if (e.type === "reservation") {
                                  setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                                }
                              }}
                              className={`p-2 rounded-xl text-xs font-bold cursor-grab active:cursor-grabbing shadow-2xs flex items-center gap-2 transition-transform hover:scale-102 ${e.color}`}
                            >
                              <IconComp className="h-4 w-4 shrink-0" />
                              <span className="font-bold">{e.title}</span>
                              <Badge className={`text-xs font-mono font-bold border-none ${e.badgeBg}`}>
                                {formatTime(e.startDate)} - {formatTime(e.endDate)}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          )}

          {view === "agenda" && (
            <div className="divide-y divide-border/20 p-6 max-h-[620px] overflow-y-auto custom-scrollbar">
              {filteredEvents.length === 0 ? (
                <EmptyMessage title="No hay compromisos en estas fechas" description="Probá con otra semana o con otro filtro." icon={Calendar} className="py-20" />
              ) : (
                filteredEvents
                  .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                  .map((e) => {
                    const IconComp = e.icon;
                    return (
                      <div
                        key={e.id}
                        onClick={() => {
                          setSelectedEvent(e);
                          setSearchQuery("");
                          setRescheduleDate(e.startDate.toISOString().split("T")[0]);
                          setRescheduleTime(e.startDate.toTimeString().split(" ")[0].substring(0, 5));
                          if (e.type === "reservation") {
                            setRescheduleEndTime(e.endDate.toTimeString().split(" ")[0].substring(0, 5));
                          }
                        }}
                        className="py-4 flex items-start md:items-center justify-between gap-4 group cursor-pointer hover:bg-muted/20 px-4 rounded-2xl transition-all"
                      >
                        <div className="flex items-start md:items-center gap-4">
                          <div className="p-2.5 bg-muted rounded-2xl text-center shrink-0 w-16 shadow-2xs border border-border/40">
                            <p className="text-xs font-bold text-muted-foreground">
                              {e.startDate.toLocaleDateString("es-AR", { weekday: "short" })}
                            </p>
                            <p className="text-lg font-bold text-foreground">
                              {e.startDate.getDate()}
                            </p>
                          </div>

                          <div>
                            <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                              <IconComp className="h-4 w-4 shrink-0 text-primary" />
                              {e.title}
                              <Badge className={`rounded-full px-2.5 py-0.5 text-xs font-bold border-none ${e.badgeBg}`}>
                                {e.type === "reservation" ? "Reserva" : e.type === "order" ? "Entrega OC" : "Tarea"}
                              </Badge>
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {e.raw?.description || e.raw?.reason || "Sin detalles adicionales."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            {formatTime(e.startDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </Card>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300">
          <Card className="w-full max-w-lg bg-card border border-border/60 shadow-xl p-6 space-y-6 relative rounded-2xl animate-in zoom-in-95 duration-200">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedEvent(null)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              <Badge className={`rounded-full px-3 py-0.5 text-xs font-bold tracking-widest border-none w-fit ${selectedEvent.badgeBg}`}>
                {selectedEvent.type === "reservation" ? "Reserva de vehículo" : selectedEvent.type === "order" ? "Entrega de orden" : "Tarea administrativa"}
              </Badge>
              <h3 className="text-xl font-bold text-foreground tracking-tight">{selectedEvent.title}</h3>
            </div>

            <div className="bg-muted/40 rounded-2xl border border-border/40 p-4 space-y-3.5">
              {selectedEvent.type === "reservation" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Período: <span className="text-muted-foreground font-medium">{formatFechaHora(selectedEvent.startDate)} al {formatFechaHora(selectedEvent.endDate)}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <User className="h-4 w-4 text-blue-500" />
                    <span>Responsable: <span className="text-muted-foreground font-medium">{selectedEvent.raw?.user?.name || "Agente municipal"}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    <span>Área: <span className="text-muted-foreground font-medium">{selectedEvent.raw?.user?.area?.name || "Sin Área"}</span></span>
                  </div>
                  {selectedEvent.raw?.reason && (
                    <div className="pt-2 border-t border-border/20 text-xs text-muted-foreground italic font-medium">
                      Motivo: &ldquo;{selectedEvent.raw.reason}&rdquo;
                    </div>
                  )}
                </>
              )}

              {selectedEvent.type === "order" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <span>Entrega pactada: <span className="text-muted-foreground font-medium">{formatFechaHora(selectedEvent.startDate)}</span></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <User className="h-4 w-4 text-emerald-500" />
                    <span>Proveedor: <span className="text-muted-foreground font-medium">{selectedEvent.raw?.providerName || "No registrado"}</span></span>
                  </div>
                  {selectedEvent.raw?.providerCuit && (
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                      <Briefcase className="h-4 w-4 text-emerald-500" />
                      <span>CUIT: <span className="text-muted-foreground font-medium">{selectedEvent.raw.providerCuit}</span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <ShoppingBag className="h-4 w-4 text-emerald-500" />
                    <span>Importe total: <span className="text-emerald-700 dark:text-emerald-400 font-bold">${Number(selectedEvent.raw?.amount || 0).toLocaleString("es-AR")}</span></span>
                  </div>
                </>
              )}

              {selectedEvent.type === "task" && (
                <>
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span>Vencimiento: <span className="text-muted-foreground font-medium">{formatFechaHora(selectedEvent.startDate)}</span></span>
                  </div>
                  {selectedEvent.raw?.description && (
                    <div className="pt-2 border-t border-border/20 text-xs text-muted-foreground italic font-medium">
                      Detalle: &ldquo;{selectedEvent.raw.description}&rdquo;
                    </div>
                  )}
                  {selectedEvent.raw?.viewerIds && (
                    <div className="pt-2 border-t border-border/20 flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                      <Eye className="h-3 w-3 text-amber-500" /> Compartida con {selectedEvent.raw.viewerIds.split(",").length} agentes
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-border/20">
              <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Edit2 className="h-3.5 w-3.5" /> Reprogramar horarios de logística
              </h4>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Fecha</Label>
                    <Input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="bg-muted/40 border-border/60 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {selectedEvent.type === "reservation" ? "Hora de inicio" : "Hora"}
                    </Label>
                    <Input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="bg-muted/40 border-border/60 rounded-xl text-xs"
                    />
                  </div>

                  {selectedEvent.type === "reservation" && (
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-muted-foreground">Hora fin</Label>
                      <Input
                        type="time"
                        value={rescheduleEndTime}
                        onChange={(e) => setRescheduleEndTime(e.target.value)}
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
                    className="rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleReschedule}
                    disabled={isRescheduling}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 font-bold text-xs shadow-md"
                  >
                    {isRescheduling ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-start">
              <Link
                href={
                  selectedEvent.type === "reservation"
                    ? "/admin/vehicles"
                    : selectedEvent.type === "order"
                    ? `/admin/purchase-orders/${selectedEvent.id}`
                    : "/tasks"
                }
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
              >
                Ver detalle completo <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </Card>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300">
          <Card className="w-full max-w-xl bg-card border border-border/60 shadow-xl p-6 space-y-6 relative rounded-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-foreground tracking-tight">Nueva tarea compartida</h3>
              <p className="text-sm text-muted-foreground font-medium">Creá tareas y elegí quién más las puede ver.</p>
            </div>

            <form onSubmit={handleAddTask} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold text-muted-foreground">Título de la tarea</Label>
                <Input
                  id="title"
                  placeholder="Ej: Entrega de documentación de resmas"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  required
                  className="bg-muted/40 border-border/60 rounded-xl h-11 text-xs font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc" className="text-xs font-bold text-muted-foreground">Descripción / detalles</Label>
                <textarea
                  id="desc"
                  rows={2}
                  placeholder="Contá el objetivo o el motivo de la tarea"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  className="flex min-h-[60px] w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-xs font-bold text-muted-foreground">Fecha de vencimiento</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    required
                    className="bg-muted/40 border-border/60 rounded-xl h-11 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueTime" className="text-xs font-bold text-muted-foreground">Hora de vencimiento</Label>
                  <Input
                    id="dueTime"
                    type="time"
                    value={newTaskDueTime}
                    onChange={(e) => setNewTaskDueTime(e.target.value)}
                    required
                    className="bg-muted/40 border-border/60 rounded-xl h-11 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Eye className="h-4 w-4 text-amber-500" /> Invitar agentes a ver esta tarea
                </Label>

                <div className="border border-border/40 rounded-xl p-3.5 max-h-40 overflow-y-auto bg-muted/30 space-y-2">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-3 cursor-pointer text-xs font-bold select-none group text-foreground">
                      <input
                        type="checkbox"
                        checked={newTaskViewerIds.includes(u.id)}
                        onChange={() => handleViewerToggle(u.id)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4.5 w-4.5 border-border"
                      />
                      <span className="group-hover:text-primary transition-colors flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs uppercase">
                          {u.name?.[0]}
                        </div>
                        {u.name} <span className="text-xs text-muted-foreground font-medium italic">({u.area?.name || "Sin Área"})</span>
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
                  className="rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 font-bold text-xs shadow-md"
                >
                  {isSaving ? "Creando..." : "Crear y compartir"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
