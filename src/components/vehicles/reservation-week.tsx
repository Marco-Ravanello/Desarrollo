"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_TONE_CLASS, RESERVATION_STATUS_TONE } from "@/lib/status-tones";
import { formatReservationRange, reservationStatusLabel } from "@/lib/vehicle-reservations";
import { WEEKDAY_SHORT, startOfWeekMonday } from "@/lib/agenda";
import {
  addDays, blockTimeLabel, blocksForDay, horaCorta, clampDrag, dayStart, firstConflict, gridHoursFor, slotCount, slotIsBusy, slotIsPast, slotRange,
  type BusyReservation,
} from "@/lib/vehicle-grid";

// La semana de un vehículo: lo ocupado pintado y el horario del pedido se elige arrastrando
// (o tocando la salida y después la vuelta, en el celular).

const SLOT_PX = 22;

type Selection = { start: Date; end: Date } | null;

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

const sameDay = (a: Date, b: Date) => dayStart(a).getTime() === dayStart(b).getTime();
const monthName = (d: Date) => d.toLocaleDateString("es-AR", { month: "long" });

export function weekTitle(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) return `Semana del ${weekStart.getDate()} al ${end.getDate()} de ${monthName(end)}`;
  return `Semana del ${weekStart.getDate()} de ${monthName(weekStart)} al ${end.getDate()} de ${monthName(end)}`;
}

export function BusyBlockLabel({
  status, who, start, end, compact, fromBefore = false, toAfter = false,
}: { status: string; who: string; start: Date; end: Date; compact?: boolean; fromBefore?: boolean; toAfter?: boolean }) {
  return (
    <>
      <span className="block truncate font-bold tabular-nums">{blockTimeLabel(start, end, fromBefore, toAfter)}</span>
      {!compact && (
        <span className="block truncate">
          {reservationStatusLabel(status)} · {who}
        </span>
      )}
    </>
  );
}

export function busyBlockClass(status: string): string {
  const tone = RESERVATION_STATUS_TONE[status] ?? "slate";
  return `${STATUS_TONE_CLASS[tone]} ${status === "PENDIENTE" ? "border-dashed" : ""}`;
}

export function ReservationWeek({
  reservations,
  selection,
  conflict,
  onSelect,
  weekStart,
  onWeekChange,
  disabledMessage,
}: {
  reservations: BusyReservation[];
  selection: Selection;
  conflict: boolean;
  onSelect: (start: Date, end: Date) => void;
  weekStart: Date;
  onWeekChange: (d: Date) => void;
  disabledMessage?: string | null;
}) {
  const isPhone = useIsPhone();
  const now = useNow();
  const [phoneDay, setPhoneDay] = useState<Date>(() => dayStart(new Date()));
  // Mientras se arrastra: el día, desde qué tramo y hasta cuál.
  const [drag, setDrag] = useState<{ day: Date; anchor: number; current: number } | null>(null);
  // En el celular: el primer toque marca la salida y el segundo, la vuelta.
  const tapAnchor = useRef<{ day: Date; slot: number } | null>(null);

  // Si cambia la semana, el día del celular sigue dentro de ella.
  useEffect(() => {
    if (phoneDay < weekStart || phoneDay >= addDays(weekStart, 7)) {
      const today = dayStart(new Date());
      setPhoneDay(today >= weekStart && today < addDays(weekStart, 7) ? today : weekStart);
    }
  }, [weekStart, phoneDay]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const days = useMemo(() => (isPhone ? [phoneDay] : weekDays), [isPhone, phoneDay, weekDays]);
  const hours = useMemo(() => gridHoursFor(reservations, days), [reservations, days]);
  const slots = slotCount(hours);
  const height = slots * SLOT_PX;
  const disabled = Boolean(disabledMessage);

  const slotAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(slots - 1, Math.max(0, Math.floor((e.clientY - rect.top) / SLOT_PX)));
  };

  const preview: Selection = drag ? slotRange(drag.day, drag.anchor, drag.current, hours) : selection;

  const onDown = (e: React.PointerEvent<HTMLDivElement>, day: Date) => {
    if (disabled || e.button > 0) return;
    const slot = slotAt(e);
    if (slotIsPast(day, slot, hours, now) || slotIsBusy(reservations, day, slot, hours)) return;
    const prev = tapAnchor.current;
    if (e.pointerType !== "mouse" && prev && sameDay(prev.day, day) && slot > prev.slot) {
      const end = clampDrag(reservations, day, prev.slot, slot, hours, now);
      const r = slotRange(day, prev.slot, end, hours);
      tapAnchor.current = null;
      onSelect(r.start, r.end);
      return;
    }
    if (e.pointerType === "mouse") e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ day, anchor: slot, current: slot });
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerType !== "mouse") return;
    const target = clampDrag(reservations, drag.day, drag.anchor, slotAt(e), hours, now);
    if (target !== drag.current) setDrag({ ...drag, current: target });
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const r = slotRange(drag.day, drag.anchor, drag.current, hours);
    tapAnchor.current = e.pointerType !== "mouse" && drag.anchor === drag.current ? { day: drag.day, slot: drag.anchor } : null;
    setDrag(null);
    onSelect(r.start, r.end);
  };

  const hourMarks = Array.from({ length: hours[1] - hours[0] + 1 }, (_, i) => hours[0] + i);
  const cols = isPhone ? "grid-cols-[2.75rem_1fr]" : "grid-cols-[3rem_repeat(7,minmax(0,1fr))]";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => onWeekChange(addDays(weekStart, -7))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => onWeekChange(addDays(weekStart, 7))} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl text-xs font-bold"
            onClick={() => {
              onWeekChange(startOfWeekMonday(new Date()));
              setPhoneDay(dayStart(new Date()));
            }}
          >
            Hoy
          </Button>
        </div>
        <p className="text-sm font-bold text-foreground first-letter:uppercase">{weekTitle(weekStart)}</p>
      </div>

      {isPhone && (
        <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="Día de la semana">
          {weekDays.map((d, i) => {
            const active = sameDay(d, phoneDay);
            const busy = blocksForDay(reservations, d, [0, 24]).length > 0;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPhoneDay(d)}
                className={`flex flex-col items-center rounded-xl border py-1.5 text-xs font-bold transition-colors ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-background text-foreground"
                }`}
              >
                <span className={active ? "" : "text-muted-foreground"}>{WEEKDAY_SHORT[i]}</span>
                <span className="tabular-nums">{d.getDate()}</span>
                <span className={`mt-0.5 h-1 w-1 rounded-full ${busy ? (active ? "bg-primary-foreground" : "bg-amber-500") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card">
        {/* Encabezado con los días */}
        {!isPhone && (
          <div className={`grid ${cols} border-b border-border/60 bg-muted/30`}>
            <div />
            {weekDays.map((d, i) => {
              const today = sameDay(d, now);
              return (
                <div key={i} className={`border-l border-border/40 px-1 py-2 text-center ${today ? "bg-primary/10" : ""}`}>
                  <p className={`text-[11px] font-bold uppercase ${today ? "text-primary" : "text-muted-foreground"}`}>{WEEKDAY_SHORT[i]}</p>
                  <p className={`text-base font-bold tabular-nums ${today ? "text-primary" : "text-foreground"}`}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className={`grid ${cols}`}>
          {/* Horas */}
          <div className="relative" style={{ height }}>
            {hourMarks.slice(0, -1).map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground first:translate-y-0"
                style={{ top: (h - hours[0]) * 2 * SLOT_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {days.map((day) => {
            const blocks = blocksForDay(reservations, day, hours);
            const dayBegin = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours[0]);
            const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours[1]);
            const span = dayEnd.getTime() - dayBegin.getTime();
            const pastFrac = Math.min(1, Math.max(0, (now.getTime() - dayBegin.getTime()) / span));
            const sel = preview && preview.start < dayEnd && preview.end > dayBegin ? preview : null;
            const selTop = sel ? Math.max(0, (sel.start.getTime() - dayBegin.getTime()) / span) : 0;
            const selBottom = sel ? Math.min(1, (sel.end.getTime() - dayBegin.getTime()) / span) : 0;
            const selConflict = sel && (drag ? Boolean(firstConflict(reservations, sel.start, sel.end)) : conflict);
            return (
              <div
                key={day.toISOString()}
                className={`relative select-none border-l border-border/40 ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
                style={{ height, touchAction: "pan-y" }}
                onPointerDown={(e) => onDown(e, day)}
                onPointerMove={onMove}
                onPointerUp={finish}
                onPointerCancel={finish}
                aria-label={`Horarios del ${day.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
              >
                {/* Renglones de media hora */}
                {Array.from({ length: slots }, (_, s) => (
                  <div
                    key={s}
                    className={`border-b ${s % 2 === 1 ? "border-border/50" : "border-dashed border-border/25"}`}
                    style={{ height: SLOT_PX }}
                  />
                ))}

                {/* Lo que ya pasó */}
                {pastFrac > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-muted/60 [background-image:repeating-linear-gradient(135deg,transparent_0_6px,hsl(var(--border)/0.5)_6px_7px)]"
                    style={{ height: `${pastFrac * 100}%` }}
                  />
                )}
                {pastFrac > 0 && pastFrac < 1 && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-rose-500" style={{ top: `${pastFrac * 100}%` }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
                  </div>
                )}

                {/* Ocupado */}
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    onPointerDown={(e) => e.stopPropagation()}
                    title={`${reservationStatusLabel(b.status)} · ${b.who}\n${formatReservationRange(b.start, b.end)}`}
                    className={`absolute inset-x-0.5 z-10 cursor-not-allowed overflow-hidden rounded-lg border-2 px-1.5 py-0.5 text-[11px] leading-tight ${busyBlockClass(b.status)} ${
                      b.fromBefore ? "rounded-t-none border-t-0" : ""
                    } ${b.toAfter ? "rounded-b-none border-b-0" : ""}`}
                    style={{ top: `${b.top * 100}%`, height: `${b.height * 100}%`, minHeight: SLOT_PX - 2 }}
                  >
                    <BusyBlockLabel status={b.status} who={b.who} start={b.start} end={b.end} fromBefore={b.fromBefore} toAfter={b.toAfter} compact={b.height * height < 40} />
                  </div>
                ))}

                {/* El pedido */}
                {sel && selBottom > selTop && (
                  <div
                    className={`pointer-events-none absolute inset-x-1 z-30 overflow-hidden rounded-lg border-2 px-1.5 py-0.5 text-[11px] font-bold leading-tight shadow-md ${
                      selConflict
                        ? "border-rose-600 bg-rose-500/25 text-rose-800 dark:text-rose-200"
                        : "border-emerald-600 bg-emerald-500/25 text-emerald-900 dark:text-emerald-100"
                    }`}
                    style={{ top: `${selTop * 100}%`, height: `${(selBottom - selTop) * 100}%` }}
                  >
                    <span className="block truncate tabular-nums">
                      {horaCorta(sel.start)} a {horaCorta(sel.end)} h
                    </span>
                    {(selBottom - selTop) * height >= 40 && <span className="block truncate font-semibold">{selConflict ? "Se pisa con otra" : "Tu pedido"}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {disabled && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-6 text-center backdrop-blur-[1px]">
            <p className="max-w-xs rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm">{disabledMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
