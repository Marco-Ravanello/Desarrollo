"use client";

import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Calendar, CalendarDays, User, Briefcase,
  Clock, CheckSquare, ShoppingBag, Plus, X, Eye, Search,
  Edit2, ArrowRight, Car, Check, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyMessage } from "@/components/ui/empty-message";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  rescheduleTaskAction,
  rescheduleReservationAction,
  reschedulePurchaseOrderAction,
  createSharedTaskAction
} from "@/app/(dashboard)/admin/actions/calendar-actions";
import { toggleTaskAction } from "@/app/(dashboard)/tasks/actions";
import { formatFechaHora, formatFechaCalendario, formatHora } from "@/lib/fechas";
import {
  WEEKDAY_LETTER, WEEKDAY_SHORT, chipsThatFit, dateOnlyToLocal, isDateOnly, localDayKey, localTimeKey,
  isTaskVisibleTo, monthCells, shortEventLabel, startOfWeekMonday, visibleHourRange, type AgendaEventType
} from "@/lib/agenda";

interface UnifiedCalendarProps {
  reservations: any[];
  purchaseOrders: any[];
  tasks: any[];
  users: any[];
  currentUserId: string;
}

type CalendarViewType = "month" | "week" | "day" | "agenda";

interface AgendaEvent {
  id: string;
  type: AgendaEventType;
  title: string;
  /** Lo que entra en la casilla de un día: la patente, la orden o la tarea. */
  short: string;
  startDate: Date;
  endDate: Date;
  /** Solo fecha, sin hora (la entrega de una orden). */
  allDay: boolean;
  color: string;
  icon: typeof Car;
  raw: any;
  isOwner?: boolean;
  /** Tarea marcada como hecha: se ve tachada. */
  done?: boolean;
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Cómo se ve cada tipo: el filtro de arriba, las casillas y el punto del celular. */
const TYPES: Record<AgendaEventType, {
  label: string;
  kind: string;
  icon: typeof Car;
  color: string;
  dot: string;
  on: string;
  badge: string;
}> = {
  reservation: {
    label: "Vehículos",
    kind: "Reserva de vehículo",
    icon: Car,
    color: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-l-4 border-l-blue-500 border-border/40 hover:bg-blue-500/20",
    dot: "bg-blue-500",
    on: "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300",
    badge: "bg-blue-500/20 text-blue-800 dark:text-blue-300",
  },
  order: {
    label: "Entregas",
    kind: "Entrega de orden de compra",
    icon: ShoppingBag,
    color: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-l-4 border-l-emerald-500 border-border/40 hover:bg-emerald-500/20",
    dot: "bg-emerald-500",
    on: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
  },
  task: {
    label: "Tareas",
    kind: "Tarea",
    icon: CheckSquare,
    color: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-l-4 border-l-amber-500 border-border/40 hover:bg-amber-500/20",
    dot: "bg-amber-500",
    on: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    badge: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  },
};

const TYPE_ORDER: AgendaEventType[] = ["reservation", "order", "task"];

/** Una tarea hecha: gris y tachada, para distinguirla de las pendientes. */
const DONE_COLOR = "bg-muted/60 text-muted-foreground line-through decoration-1 border-l-4 border-l-muted-foreground/40 border-border/40 hover:bg-muted";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Lo que está en ese día (las reservas de varios días aparecen en cada uno), primero lo de todo el día. */
function eventsOnDay(events: AgendaEvent[], date: Date): AgendaEvent[] {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
  return events
    .filter((e) => e.startDate < dayEnd && (e.endDate > dayStart || e.startDate >= dayStart))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startDate.getTime() - b.startDate.getTime());
}

export function UnifiedCalendar({ reservations = [], purchaseOrders = [], tasks = [], users = [], currentUserId }: UnifiedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("week");
  const [showPicker, setShowPicker] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const [visible, setVisible] = useState<Record<AgendaEventType, boolean>>({ reservation: true, order: true, task: true });
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
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
  const [togglingTask, setTogglingTask] = useState(false);
  // Lo que se marcó como hecho (o se reabrió) recién, hasta que llegue la agenda actualizada.
  const [doneOverride, setDoneOverride] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const [nowClock, setNowClock] = useState(new Date());
  // Las fechas dependen de la hora de la compu de cada persona: la agenda se arma recién en el navegador
  // (si se arma en el servidor, que está en otra zona horaria, los días y las horas no coinciden).
  const [mounted, setMounted] = useState(false);

  // En el celular la semana no entra: arranca en la lista de próximos eventos.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setView("agenda");
    setCurrentDate(new Date());
    setMiniCalMonth(new Date());
    setNowClock(new Date());
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const shift = (days: number, months = 0) =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + months, months ? 1 : currentDate.getDate() + days));
  const goPrev = () => (view === "month" ? shift(0, -1) : shift(view === "day" ? -1 : -7));
  const goNext = () => (view === "month" ? shift(0, 1) : shift(view === "day" ? 1 : 7));

  const goToDay = (date: Date) => {
    setCurrentDate(date);
    setView("day");
    setShowPicker(false);
  };

  // Todo lo que esta persona puede ver, sin mirar los filtros (para contar cuántos hay de cada tipo).
  const baseEvents: AgendaEvent[] = [];

  reservations.forEach((r) => {
    if (!r) return;
    const brand = r.vehicle?.brand || "Vehículo";
    const model = r.vehicle?.model || "";
    const plate = r.vehicle?.plate || "sin patente";
    baseEvents.push({
      id: r.id,
      type: "reservation",
      title: `${brand} ${model}`.trim() + ` (${plate})`,
      short: shortEventLabel("reservation", r),
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      allDay: false,
      color: TYPES.reservation.color,
      icon: Car,
      raw: r,
    });
  });

  purchaseOrders.forEach((o) => {
    if (!o?.deliveryDate) return;
    const stored = new Date(o.deliveryDate);
    const allDay = isDateOnly(stored);
    const start = allDay ? dateOnlyToLocal(stored) : stored;
    baseEvents.push({
      id: o.id,
      type: "order",
      title: `Entrega de la orden N° ${o.number || "sin número"}`,
      short: shortEventLabel("order", o),
      startDate: start,
      endDate: start,
      allDay,
      color: TYPES.order.color,
      icon: ShoppingBag,
      raw: o,
    });
  });

  tasks.forEach((t) => {
    if (!t?.dueDate) return;
    if (!isTaskVisibleTo(t, currentUserId)) return;
    const isOwner = t.userId === currentUserId;
    const done = doneOverride[t.id] ?? t.status === "COMPLETADA";
    baseEvents.push({
      id: t.id,
      type: "task",
      title: t.title || "Tarea sin título",
      short: shortEventLabel("task", t),
      startDate: new Date(t.dueDate),
      endDate: new Date(t.dueDate),
      allDay: false,
      color: done ? DONE_COLOR : TYPES.task.color,
      icon: CheckSquare,
      raw: t,
      isOwner,
      done,
    });
  });

  const counts: Record<AgendaEventType, number> = { reservation: 0, order: 0, task: 0 };
  baseEvents.forEach((e) => (counts[e.type] += 1));

  const q = searchQuery.trim().toLowerCase();
  const filteredEvents = baseEvents.filter(
    (e) =>
      visible[e.type] &&
      (!q || e.title.toLowerCase().includes(q) || (e.raw?.description && String(e.raw.description).toLowerCase().includes(q)))
  );

  const startOfWeek = startOfWeekMonday(currentDate);
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i));

  const openEvent = (e: AgendaEvent) => {
    setSelectedEvent(e);
    setRescheduleDate(localDayKey(e.startDate));
    setRescheduleTime(localTimeKey(e.startDate));
    if (e.type === "reservation") setRescheduleEndTime(localTimeKey(e.endDate));
  };

  const handleDragStart = (e: React.DragEvent, eventItem: AgendaEvent) => {
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

      const toastId = toast.loading("Cambiando la fecha…");
      let res;

      if (type === "task") {
        res = await rescheduleTaskAction(id, computedStart.toISOString());
      } else if (type === "order") {
        // La entrega es solo un día: se guarda como las fechas del calendario (medianoche UTC).
        res = await reschedulePurchaseOrderAction(id, `${localDayKey(targetDate)}T00:00:00.000Z`);
      } else if (type === "reservation") {
        // Se mueve con la misma duración que tenía.
        const original = reservations.find((r) => r?.id === id);
        const duration = original ? new Date(original.endDate).getTime() - new Date(original.startDate).getTime() : 2 * 3600000;
        const computedEnd = new Date(computedStart.getTime() + Math.max(duration, 15 * 60000));
        res = await rescheduleReservationAction(id, computedStart.toISOString(), computedEnd.toISOString());
      }

      if (res?.success) {
        toast.success(
          res && "backToPending" in res && res.backToPending ? "Reserva movida. Vuelve a quedar pendiente de aprobación." : "Listo, se cambió la fecha.",
          { id: toastId }
        );
      } else {
        toast.error(res?.error || "No se pudo cambiar la fecha.", { id: toastId });
      }
    } catch (err: any) {
      toast.error("No se pudo mover: " + err.message);
    }
  };

  const handleReschedule = async () => {
    if (!selectedEvent) return;
    setIsRescheduling(true);
    const toastId = toast.loading("Cambiando la fecha…");

    try {
      let res;
      const computedStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);

      if (selectedEvent.type === "task") {
        res = await rescheduleTaskAction(selectedEvent.id, computedStart.toISOString());
      } else if (selectedEvent.type === "reservation") {
        const computedEnd = new Date(`${rescheduleDate}T${rescheduleEndTime}:00`);
        res = await rescheduleReservationAction(selectedEvent.id, computedStart.toISOString(), computedEnd.toISOString());
      } else if (selectedEvent.type === "order") {
        res = await reschedulePurchaseOrderAction(selectedEvent.id, `${rescheduleDate}T00:00:00.000Z`);
      }

      if (res?.success) {
        toast.success(
          res && "backToPending" in res && res.backToPending ? "Reserva movida. Vuelve a quedar pendiente de aprobación." : "Listo, se cambió la fecha.",
          { id: toastId }
        );
        setSelectedEvent(null);
      } else {
        toast.error(res?.error || "No se pudo cambiar la fecha.", { id: toastId });
      }
    } catch (e: any) {
      toast.error(e.message || "Ocurrió un error inesperado", { id: toastId });
    } finally {
      setIsRescheduling(false);
    }
  };

  /** Marcar la tarea como hecha desde la Agenda, o volver a dejarla pendiente. */
  const handleToggleDone = async () => {
    if (!selectedEvent || selectedEvent.type !== "task") return;
    const wasDone = Boolean(selectedEvent.done);
    setTogglingTask(true);
    try {
      const res = await toggleTaskAction(selectedEvent.id, wasDone ? "COMPLETADA" : "PENDIENTE");
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setDoneOverride((prev) => ({ ...prev, [selectedEvent.id]: !wasDone }));
      toast.success(wasDone ? "La tarea volvió a quedar pendiente." : "Listo, la tarea quedó hecha.");
      setSelectedEvent(null);
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar la tarea. Revisá la conexión y probá de nuevo.");
    } finally {
      setTogglingTask(false);
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

  /** "10:00" o "Todo el día"; las reservas, de punta a punta. */
  const whenLabel = (e: AgendaEvent) => {
    if (e.allDay) return "Todo el día";
    if (e.type === "reservation") {
      return sameDay(e.startDate, e.endDate)
        ? `${formatTime(e.startDate)} a ${formatTime(e.endDate)}`
        : `${formatTime(e.startDate)} hasta el ${e.endDate.getDate()}/${e.endDate.getMonth() + 1} ${formatTime(e.endDate)}`;
    }
    return formatTime(e.startDate);
  };

  const datesWithEvents = new Set(filteredEvents.map((e) => localDayKey(e.startDate)));

  // Semana y Día: el horario de trabajo, estirado si hay algo antes o después.
  const gridDays = view === "day" ? [currentDate] : weekDays;
  const [fromHour, toHour] = visibleHourRange(filteredEvents, gridDays);
  const gridHours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);
  const gridHasEvents = gridDays.some((d) => eventsOnDay(filteredEvents, d).length > 0);
  const gridEnd = new Date(gridDays[gridDays.length - 1].getFullYear(), gridDays[gridDays.length - 1].getMonth(), gridDays[gridDays.length - 1].getDate() + 1);
  const nextEvent = filteredEvents
    .filter((e) => e.startDate >= gridEnd)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

  // La línea roja de la hora actual va dentro de la media hora que corresponde, a la altura justa.
  const showNow = gridDays.some((d) => sameDay(d, nowClock));
  const nowLine = (hour: number, minute: number) => {
    if (!showNow || nowClock.getHours() !== hour || Math.floor(nowClock.getMinutes() / 30) * 30 !== minute) return null;
    return (
      <div
        className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-rose-500"
        style={{ top: `${((nowClock.getMinutes() - minute) / 30) * 100}%` }}
        aria-hidden
      >
        <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
      </div>
    );
  };

  const hourLabel = (hour: number, minute: number) => (minute === 0 ? `${String(hour).padStart(2, "0")}:00` : "");

  const monthLower = (d: Date) => MONTH_NAMES[d.getMonth()].toLowerCase();
  const heading =
    view === "month"
      ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : view === "week"
      ? weekDays[0].getMonth() === weekDays[6].getMonth()
        ? `Semana del ${weekDays[0].getDate()} al ${weekDays[6].getDate()} de ${monthLower(weekDays[6])}`
        : `Semana del ${weekDays[0].getDate()} de ${monthLower(weekDays[0])} al ${weekDays[6].getDate()} de ${monthLower(weekDays[6])}`
      : view === "day"
      ? `${capitalize(currentDate.toLocaleDateString("es-AR", { weekday: "long" }))} ${currentDate.getDate()} de ${monthLower(currentDate)}`
      : "Lo que viene";

  // Lista: desde hoy en adelante; lo anterior, a pedido.
  const todayStart = new Date(nowClock.getFullYear(), nowClock.getMonth(), nowClock.getDate());
  const sortedEvents = [...filteredEvents].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const pastEvents = sortedEvents.filter((e) => (e.type === "reservation" ? e.endDate : e.startDate) < todayStart);
  const listEvents = showPast ? sortedEvents : sortedEvents.filter((e) => !pastEvents.includes(e));

  // Una reserva larga ocupa varias filas: el nombre va en la primera y después sigue como una barrita.
  const continuesFrom = (e: AgendaEvent, slotStart: Date, hour: number, minute: number) =>
    e.type === "reservation" && e.startDate < slotStart && !(hour === fromHour && minute === 0);

  const eventButton = (e: AgendaEvent, className: string, children: React.ReactNode) => (
    <button
      key={e.id}
      type="button"
      draggable
      onDragStart={(ev) => handleDragStart(ev, e)}
      onClick={(ev) => {
        ev.stopPropagation();
        openEvent(e);
      }}
      title={`${e.title} (${whenLabel(e)})`}
      className={`w-full text-left cursor-grab active:cursor-grabbing shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${e.color} ${className}`}
    >
      {children}
    </button>
  );

  const miniCalendar = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">
          {MONTH_NAMES[miniCalMonth.getMonth()]} {miniCalMonth.getFullYear()}
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
        {WEEKDAY_LETTER.map((d, idx) => (
          <span key={idx} aria-hidden>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 text-center gap-y-1 text-xs">
        {monthCells(miniCalMonth.getFullYear(), miniCalMonth.getMonth()).map((date, i) => {
          if (!date) return <div key={`mini-empty-${i}`} className="h-8" />;
          const isSelected = sameDay(currentDate, date);
          const isToday = sameDay(nowClock, date);
          const hasEvent = datesWithEvents.has(localDayKey(date));
          return (
            <button
              key={i}
              type="button"
              onClick={() => goToDay(date)}
              aria-label={`Ver el ${date.getDate()} de ${monthLower(date)}${hasEvent ? " (tiene compromisos)" : ""}`}
              className={`h-8 w-8 mx-auto rounded-xl font-bold flex flex-col items-center justify-center relative transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : isToday
                  ? "border border-primary text-primary"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span>{date.getDate()}</span>
              {hasEvent && !isSelected && <span className="w-1 h-1 rounded-full bg-primary absolute bottom-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const newTaskButton = (className: string) => (
    <Button onClick={() => setShowAddModal(true)} className={`gap-2 font-bold ${className}`}>
      <Plus className="h-4 w-4 shrink-0" /> Nueva tarea
    </Button>
  );

  const emptyGrid = gridHasEvents ? null : (
    <div className="flex flex-col gap-3 border-b border-border/40 bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {view === "day" ? "No hay nada agendado este día." : "No hay nada agendado esta semana."}
        {nextEvent && ` Lo próximo es el ${nextEvent.startDate.toLocaleDateString("es-AR", { weekday: "long" })} ${nextEvent.startDate.getDate()} de ${MONTH_NAMES[nextEvent.startDate.getMonth()].toLowerCase()}.`}
      </p>
      <div className="flex shrink-0 gap-2">
        {nextEvent && (
          <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setCurrentDate(nextEvent.startDate)}>
            Ir a lo próximo
          </Button>
        )}
        <Button
          size="sm"
          className="rounded-full text-xs gap-1.5"
          onClick={() => {
            const first = gridDays.find((d) => d >= new Date(nowClock.getFullYear(), nowClock.getMonth(), nowClock.getDate())) ?? gridDays[0];
            setNewTaskDueDate(localDayKey(first));
            setShowAddModal(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Agendar una tarea
        </Button>
      </div>
    </div>
  );

  const allDayRow = (days: Date[], gridClass: string, labelClass: string) => {
    const perDay = days.map((d) => eventsOnDay(filteredEvents, d).filter((e) => e.allDay));
    if (perDay.every((list) => list.length === 0)) return null;
    return (
      <div className={`${gridClass} border-b border-border/40 bg-muted/10`}>
        <div className={labelClass}>Todo el día</div>
        {days.map((date, idx) => (
          <div
            key={idx}
            onDragOver={handleDragOver}
            onDrop={(ev) => handleDropOnSlot(ev, date, 9, 0)}
            className="border-r border-border/40 last:border-r-0 p-1 flex flex-col gap-1"
          >
            {perDay[idx].map((e) => {
              const IconComp = e.icon;
              return eventButton(
                e,
                "rounded-lg px-1.5 py-1 text-xs font-semibold flex items-center gap-1 min-w-0",
                <>
                  <IconComp className="h-3 w-3 shrink-0" />
                  <span className="truncate">{e.short}</span>
                </>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  if (!mounted) {
    return (
      <Card className="h-[32rem] animate-pulse rounded-2xl border border-border/60 bg-muted/30" aria-busy="true">
        <span className="sr-only">Cargando la agenda…</span>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[17rem_minmax(0,1fr)] gap-6">
      <div className="hidden 2xl:block min-w-0">
        <Card className="bg-card text-card-foreground border border-border/60 shadow-xs p-5 space-y-5 rounded-2xl">
          {miniCalendar}
          <div className="pt-4 border-t border-border/40">
            {newTaskButton("w-full rounded-2xl min-h-11")}
          </div>
        </Card>
      </div>

      <div className="min-w-0">
        <Card className="bg-card text-card-foreground border border-border/60 shadow-xs overflow-hidden rounded-2xl">
          <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="font-bold text-lg sm:text-xl text-foreground">{heading}</h2>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {view !== "agenda" && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/40">
                      <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Anterior" className="h-8 w-8 rounded-xl text-foreground">
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
                      <Button variant="ghost" size="icon" onClick={goNext} aria-label="Siguiente" className="h-8 w-8 rounded-xl text-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPicker(!showPicker)}
                      aria-expanded={showPicker}
                      className="2xl:hidden h-10 rounded-2xl gap-1.5 text-xs font-bold"
                    >
                      <CalendarDays className="h-4 w-4" /> Elegir fecha
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-4 bg-muted/60 p-1 rounded-2xl border border-border/40" role="group" aria-label="Cómo ver la agenda">
                  {(["month", "week", "day", "agenda"] as CalendarViewType[]).map((v) => (
                    <Button
                      key={v}
                      onClick={() => setView(v)}
                      variant="ghost"
                      size="sm"
                      aria-pressed={view === v}
                      className={`h-8 text-xs font-bold px-3 rounded-xl ${
                        view === v ? "bg-background text-foreground shadow-xs hover:bg-background" : "text-muted-foreground"
                      }`}
                    >
                      {v === "month" ? "Mes" : v === "week" ? "Semana" : v === "day" ? "Día" : "Lista"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Qué mostrar">
                {TYPE_ORDER.map((type) => {
                  const t = TYPES[type];
                  const on = visible[type];
                  const IconComp = t.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={on}
                      title={on ? `Ocultar ${t.label.toLowerCase()}` : `Mostrar ${t.label.toLowerCase()}`}
                      onClick={() => setVisible({ ...visible, [type]: !on })}
                      className={`flex h-9 min-w-0 items-center justify-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        on ? t.on : "border-border/60 bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <IconComp className="hidden sm:block h-3.5 w-3.5 shrink-0" />
                      <span className={`truncate ${on ? "" : "line-through decoration-1"}`}>{t.label}</span>
                      <span className="tabular-nums opacity-80">{counts[type]}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 md:ml-auto">
                <div className="relative flex-1 md:w-60 md:flex-none">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar en la agenda"
                    aria-label="Buscar en la agenda"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-border/60 text-foreground rounded-full text-xs h-9 pl-8"
                  />
                </div>
                {newTaskButton("2xl:hidden h-9 rounded-full text-xs")}
              </div>
            </div>

            {showPicker && view !== "agenda" && (
              <div className="2xl:hidden rounded-2xl border border-border/60 bg-card p-4 max-w-sm">{miniCalendar}</div>
            )}
          </div>

          {view === "month" && (
            <div>
              <div className="grid grid-cols-7 text-center border-b border-border/40 bg-muted/30 py-2.5">
                {WEEKDAY_SHORT.map((day) => (
                  <div key={day} className="text-xs font-bold text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells(currentDate.getFullYear(), currentDate.getMonth()).map((date, i) => {
                  if (!date) return <div key={`empty-${i}`} className="min-h-[4.5rem] sm:h-32 border-b border-r border-border/40 bg-muted/10" />;
                  const isToday = sameDay(nowClock, date);
                  const dayEvents = eventsOnDay(filteredEvents, date);
                  const { shown, more } = chipsThatFit(dayEvents, 3);

                  return (
                    <div
                      key={i}
                      onDragOver={handleDragOver}
                      onDrop={(ev) => handleDropOnSlot(ev, date, 9, 0)}
                      onClick={() => goToDay(date)}
                      className={`min-h-[4.5rem] sm:h-32 border-b border-r border-border/40 p-1 sm:p-1.5 flex flex-col cursor-pointer transition-colors hover:bg-muted/20 ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          goToDay(date);
                        }}
                        aria-label={`Ver el ${date.getDate()} de ${monthLower(date)}${dayEvents.length ? `: ${dayEvents.length} ${dayEvents.length === 1 ? "compromiso" : "compromisos"}` : ""}`}
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center mb-1 shrink-0 hover:ring-2 hover:ring-primary/30 ${
                          isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {date.getDate()}
                      </button>

                      {/* En compu: hora y nombre corto. */}
                      <div className="hidden sm:flex flex-col gap-1 min-h-0">
                        {shown.map((e) =>
                          eventButton(
                            e,
                            "rounded-md px-1.5 py-0.5 text-xs leading-5 flex items-center gap-1 min-w-0",
                            <>
                              {!e.allDay && <span className="tabular-nums font-semibold shrink-0">{formatTime(e.startDate)}</span>}
                              <span className="truncate font-medium">{e.short}</span>
                            </>
                          )
                        )}
                        {more > 0 && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              goToDay(date);
                            }}
                            className="text-left px-1.5 text-xs font-bold text-primary hover:underline"
                          >
                            +{more} más
                          </button>
                        )}
                      </div>

                      {/* En el celular no entra el texto: un punto de color por compromiso. */}
                      {dayEvents.length > 0 && (
                        <div className="sm:hidden flex flex-wrap items-center gap-1 px-0.5" aria-hidden>
                          {dayEvents.slice(0, 4).map((e) => (
                            <span key={e.id} className={`h-2 w-2 rounded-full ${TYPES[e.type].dot}`} />
                          ))}
                          {dayEvents.length > 4 && <span className="text-[10px] font-bold text-muted-foreground">+{dayEvents.length - 4}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="overflow-x-auto custom-scrollbar">
              {emptyGrid}
              <div className="min-w-[640px] relative">
                <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border/40 bg-muted/30 py-3 text-center">
                  <div className="text-xs font-bold text-muted-foreground border-r border-border/40 flex items-center justify-center">
                    Hora
                  </div>
                  {weekDays.map((date, idx) => {
                    const isToday = sameDay(nowClock, date);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => goToDay(date)}
                        aria-label={`Ver el ${date.getDate()} de ${monthLower(date)}`}
                        className={`flex flex-col items-center justify-center border-r border-border/40 last:border-r-0 py-1 hover:bg-muted/40 ${
                          isToday ? "bg-primary/10" : ""
                        }`}
                      >
                        <span className="text-xs font-bold text-muted-foreground">{WEEKDAY_SHORT[idx]}</span>
                        <span
                          className={`text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center mt-1 ${
                            isToday ? "bg-primary text-primary-foreground shadow-xs" : "text-foreground"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {allDayRow(
                  weekDays,
                  "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]",
                  "text-[11px] leading-tight font-bold text-muted-foreground p-1 border-r border-border/40 flex items-center justify-center text-center"
                )}

                <div className="divide-y divide-border/20">
                  {gridHours.map((hour) => {
                    return [0, 30].map((minute) => {
                      const isFullHour = minute === 0;
                      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

                      return (
                        <div
                          key={timeStr}
                          className={`relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] hover:bg-muted/20 ${
                            isFullHour ? "border-b border-border/40" : "border-b border-dashed border-border/20"
                          }`}
                        >
                          {nowLine(hour, minute)}
                          <div className="text-xs tabular-nums font-semibold text-muted-foreground px-1.5 pt-1 border-r border-border/40 flex justify-center bg-muted/20 select-none">
                            {hourLabel(hour, minute)}
                          </div>

                          {weekDays.map((date, dayIdx) => {
                            const isToday = sameDay(nowClock, date);
                            const currentSlotStart = new Date(date);
                            currentSlotStart.setHours(hour, minute, 0, 0);
                            const currentSlotEnd = new Date(currentSlotStart);
                            currentSlotEnd.setMinutes(currentSlotStart.getMinutes() + 30);

                            const slotEvents = filteredEvents.filter((e) => {
                              if (e.allDay) return false;
                              return (
                                (e.startDate < currentSlotEnd && e.endDate > currentSlotStart) ||
                                (e.startDate >= currentSlotStart && e.startDate < currentSlotEnd && e.type !== "reservation")
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
                                {slotEvents.map((e) =>
                                  continuesFrom(e, currentSlotStart, hour, minute) ? (
                                    eventButton(e, "h-2 rounded-full", null)
                                  ) : eventButton(
                                    e,
                                    "p-1.5 rounded-xl text-xs leading-tight flex items-center gap-1 min-w-0",
                                    <>
                                      <span className="tabular-nums font-semibold shrink-0">{formatTime(e.startDate)}</span>
                                      <span className="truncate font-medium">{e.short}</span>
                                    </>
                                  )
                                )}
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
            <div>
              {emptyGrid}
              {allDayRow(
                [currentDate],
                "grid grid-cols-[4.5rem_minmax(0,1fr)]",
                "text-xs font-bold text-muted-foreground p-3 border-r border-border/40 flex items-center justify-center bg-muted/20"
              )}
              <div className="grid grid-cols-1 divide-y divide-border/20">
                {gridHours.map((hour) => {
                  return [0, 30].map((minute) => {
                    const isFullHour = minute === 0;
                    const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                    const currentSlotStart = new Date(currentDate);
                    currentSlotStart.setHours(hour, minute, 0, 0);
                    const currentSlotEnd = new Date(currentSlotStart);
                    currentSlotEnd.setMinutes(currentSlotStart.getMinutes() + 30);

                    const slotEvents = filteredEvents.filter((e) => {
                      if (e.allDay) return false;
                      return (
                        (e.startDate < currentSlotEnd && e.endDate > currentSlotStart) ||
                        (e.startDate >= currentSlotStart && e.startDate < currentSlotEnd && e.type !== "reservation")
                      );
                    });

                    return (
                      <div
                        key={timeStr}
                        onDragOver={handleDragOver}
                        onDrop={(ev) => handleDropOnSlot(ev, currentDate, hour, minute)}
                        className={`relative grid grid-cols-[4.5rem_minmax(0,1fr)] hover:bg-muted/20 min-h-[44px] ${
                          isFullHour ? "border-b border-border/40" : "border-b border-dashed border-border/20"
                        }`}
                      >
                        {nowLine(hour, minute)}
                        <div className="text-xs tabular-nums font-semibold text-muted-foreground px-3 pt-2 border-r border-border/40 flex justify-center bg-muted/20 select-none">
                          {hourLabel(hour, minute)}
                        </div>

                        <div className="p-2 flex flex-wrap gap-2 items-center min-w-0">
                          {slotEvents.map((e) => {
                            const IconComp = e.icon;
                            if (continuesFrom(e, currentSlotStart, hour, minute)) return eventButton(e, "h-2 rounded-full", null);
                            return eventButton(
                              e,
                              "w-auto max-w-full p-2 rounded-xl text-xs flex items-center gap-2",
                              <>
                                <IconComp className="h-4 w-4 shrink-0" />
                                <span className="font-semibold min-w-0 break-words">{e.title}</span>
                                <span className="tabular-nums shrink-0 opacity-80">{whenLabel(e)}</span>
                              </>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          )}

          {view === "agenda" && (
            <div className="p-2 sm:p-4 max-h-[620px] overflow-y-auto custom-scrollbar">
              {pastEvents.length > 0 && (
                <div className="px-2 pb-2">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowPast(!showPast)}>
                    {showPast
                      ? "Ocultar los anteriores a hoy"
                      : `Ver ${pastEvents.length === 1 ? "el anterior" : `los ${pastEvents.length} anteriores`} a hoy`}
                  </Button>
                </div>
              )}
              {listEvents.length === 0 ? (
                <EmptyMessage
                  kind={baseEvents.length ? "search" : "empty"}
                  title={baseEvents.length ? "No hay nada desde hoy con estos filtros" : "No hay nada agendado"}
                  description={baseEvents.length ? "Probá con otro filtro o mirá los anteriores." : "Las reservas, las entregas y tus tareas van a aparecer acá."}
                  icon={Calendar}
                  className="py-16"
                />
              ) : (
                <ul className="divide-y divide-border/30">
                  {listEvents.map((e) => {
                    const t = TYPES[e.type];
                    const detail = e.raw?.description || e.raw?.reason;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => openEvent(e)}
                          className="w-full text-left py-3 px-2 sm:px-3 flex items-start gap-3 rounded-xl hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className={`w-12 shrink-0 rounded-xl border border-border/40 py-1.5 text-center ${sameDay(e.startDate, nowClock) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <p className="text-[11px] font-bold leading-none opacity-80">
                              {capitalize(e.startDate.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""))}
                            </p>
                            <p className="text-lg font-bold leading-tight">{e.startDate.getDate()}</p>
                            <p className="text-[11px] font-semibold leading-none opacity-80">{monthLower(e.startDate).slice(0, 3)}</p>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold break-words line-clamp-2 ${e.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{e.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${e.done ? "bg-muted-foreground/40" : t.dot}`} aria-hidden />
                              <span>{e.done ? "Tarea hecha" : t.kind}</span>
                              <span aria-hidden>·</span>
                              <span className="tabular-nums">{whenLabel(e)}</span>
                            </p>
                            {detail && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{detail}</p>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
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
              aria-label="Cerrar"
              className="absolute right-4 top-4 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              <Badge className={`rounded-full px-3 py-0.5 text-xs font-bold border-none w-fit ${TYPES[selectedEvent.type].badge}`}>
                {TYPES[selectedEvent.type].kind}
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
                    <span>Área: <span className="text-muted-foreground font-medium">{selectedEvent.raw?.user?.area?.name || "Sin área"}</span></span>
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
                    <span>Entrega pactada: <span className="text-muted-foreground font-medium">{selectedEvent.allDay ? formatFechaCalendario(selectedEvent.raw?.deliveryDate) : formatFechaHora(selectedEvent.startDate)}</span></span>
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
                  {selectedEvent.done && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <Check className="h-3.5 w-3.5" aria-hidden /> Tarea hecha
                    </div>
                  )}
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

            {selectedEvent.type === "task" && selectedEvent.raw?.canEdit && (
              <Button
                type="button"
                onClick={handleToggleDone}
                disabled={togglingTask}
                variant={selectedEvent.done ? "outline" : "default"}
                className="w-full rounded-xl gap-2 font-bold"
              >
                {selectedEvent.done ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                {togglingTask ? "Guardando…" : selectedEvent.done ? "Volver a dejarla pendiente" : "Marcar como hecha"}
              </Button>
            )}

            <div className="space-y-4 pt-4 border-t border-border/20">
              <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Edit2 className="h-3.5 w-3.5" /> Cambiar la fecha
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

                  {/* La entrega de una orden es solo un día, sin hora. */}
                  {selectedEvent.type !== "order" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">
                        {selectedEvent.type === "reservation" ? "Hora de salida" : "Hora"}
                      </Label>
                      <Input
                        type="time"
                        value={rescheduleTime}
                        onChange={(e) => setRescheduleTime(e.target.value)}
                        className="bg-muted/40 border-border/60 rounded-xl text-xs"
                      />
                    </div>
                  )}

                  {selectedEvent.type === "reservation" && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-bold text-muted-foreground">Hora de vuelta</Label>
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
                    ? selectedEvent.raw?.vehicleId ? `/admin/vehicles/${selectedEvent.raw.vehicleId}` : "/admin/vehicles"
                    : selectedEvent.type === "order"
                    ? `/admin/purchase-orders/${selectedEvent.id}`
                    : selectedEvent.raw?.caseId
                    ? `/cases/${selectedEvent.raw.caseId}`
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
              aria-label="Cerrar"
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
                        <InitialsAvatar name={u.name} seed={u.id} size="xs" />
                        {u.name} <span className="text-xs text-muted-foreground font-medium italic">({u.area?.name || "Sin área"})</span>
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
