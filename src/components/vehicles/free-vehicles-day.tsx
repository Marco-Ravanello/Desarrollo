"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reservationStatusLabel } from "@/lib/vehicle-reservations";
import { formatHora } from "@/lib/fechas";
import {
  addDays, blocksForDay, clampDrag, dayStart, firstConflict, gridHoursFor, slotCount, slotIsBusy, slotIsPast, slotRange,
  type BusyReservation,
} from "@/lib/vehicle-grid";
import { busyBlockClass } from "./reservation-week";

// "¿Cuál está libre?": un día entero, una fila por vehículo. Tocar un hueco elige ese vehículo
// (y, si todavía no hay horario, una hora desde ahí).

export type VehicleRow = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  status: string;
  reservations: BusyReservation[];
};

const UNAVAILABLE: Record<string, string> = { EN_TALLER: "En el taller", FUERA_DE_SERVICIO: "Fuera de servicio" };

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function FreeVehiclesDay({
  vehicles,
  selectedVehicleId,
  selection,
  day,
  onDayChange,
  onPick,
}: {
  vehicles: VehicleRow[];
  selectedVehicleId: string;
  selection: { start: Date; end: Date } | null;
  day: Date;
  onDayChange: (d: Date) => void;
  onPick: (vehicleId: string, range: { start: Date; end: Date } | null) => void;
}) {
  const now = useNow();
  const all = useMemo(() => vehicles.flatMap((v) => v.reservations), [vehicles]);
  const hours = useMemo(() => gridHoursFor(all, [day]), [all, day]);
  const slots = slotCount(hours);
  const begin = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours[0]);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours[1]);
  const span = end.getTime() - begin.getTime();
  const frac = (d: Date) => Math.min(1, Math.max(0, (d.getTime() - begin.getTime()) / span));
  const pastFrac = frac(now);
  const sel = selection && selection.start < end && selection.end > begin ? selection : null;
  const hourMarks = Array.from({ length: hours[1] - hours[0] }, (_, i) => hours[0] + i);
  const isToday = dayStart(day).getTime() === dayStart(now).getTime();

  const pick = (e: React.MouseEvent<HTMLDivElement>, v: VehicleRow) => {
    if (UNAVAILABLE[v.status]) return;
    // Con un horario elegido para este día: solo se cambia el vehículo.
    if (sel) return onPick(v.id, null);
    const rect = e.currentTarget.getBoundingClientRect();
    const slot = Math.min(slots - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * slots)));
    if (slotIsPast(day, slot, hours, now) || slotIsBusy(v.reservations, day, slot, hours)) return onPick(v.id, null);
    const last = clampDrag(v.reservations, day, slot, slot + 1, hours, now);
    onPick(v.id, slotRange(day, slot, last, hours));
  };

  const freeCount = sel
    ? vehicles.filter((v) => !UNAVAILABLE[v.status] && !firstConflict(v.reservations, sel.start, sel.end)).length
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => onDayChange(addDays(day, -1))} aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => onDayChange(addDays(day, 1))} aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl text-xs font-bold" onClick={() => onDayChange(dayStart(new Date()))}>
            Hoy
          </Button>
        </div>
        <p className="text-sm font-bold text-foreground first-letter:uppercase">
          {isToday ? "Hoy, " : ""}
          {day.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {sel
          ? `Para ${formatHora(sel.start)} a ${formatHora(sel.end)}: ${freeCount === 0 ? "no hay ninguno libre" : freeCount === 1 ? "hay 1 libre" : `hay ${freeCount} libres`}. Tocá una fila para elegir ese vehículo.`
          : "Tocá un hueco libre en la fila de un vehículo para elegirlo desde esa hora. Después ajustás la vuelta abajo."}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="grid grid-cols-[6.5rem_1fr] border-b border-border/60 bg-muted/30 sm:grid-cols-[11rem_1fr]">
          <p className="px-3 py-2 text-[11px] font-bold uppercase text-muted-foreground">Vehículo</p>
          <div className="relative h-8">
            {hourMarks.map((h, i) => (
              <span
                key={h}
                className={`absolute top-2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground first:translate-x-0 ${i % 2 === 1 ? "hidden sm:block" : ""}`}
                style={{ left: `${((h - hours[0]) / (hours[1] - hours[0])) * 100}%` }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-border/50">
          {vehicles.map((v) => {
            const off = UNAVAILABLE[v.status];
            const blocks = blocksForDay(v.reservations, day, hours);
            const chosen = v.id === selectedVehicleId;
            const clash = sel && !off ? firstConflict(v.reservations, sel.start, sel.end) : null;
            return (
              <li key={v.id} className={`grid grid-cols-[6.5rem_1fr] sm:grid-cols-[11rem_1fr] ${chosen ? "bg-primary/5" : ""}`}>
                <div className={`flex min-w-0 items-center gap-2 px-3 py-2 ${chosen ? "border-l-4 border-primary pl-2" : ""}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold tabular-nums text-foreground">{v.plate}</p>
                    <p className="hidden truncate text-xs text-muted-foreground sm:block">
                      {[v.brand, v.model].filter(Boolean).join(" ")}
                    </p>
                  </div>
                  {sel && !off && (
                    clash ? (
                      <XCircle className="ml-auto h-4 w-4 shrink-0 text-rose-600" aria-label="Ocupado en ese horario" />
                    ) : (
                      <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-600" aria-label="Libre en ese horario" />
                    )
                  )}
                </div>
                <div
                  className={`relative h-12 border-l border-border/40 ${off ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"}`}
                  onClick={(e) => pick(e, v)}
                  role={off ? undefined : "button"}
                  aria-label={off ? `${v.plate}: ${off.toLowerCase()}` : `Elegir ${v.plate}`}
                >
                  {/* Líneas de cada hora */}
                  {hourMarks.slice(1).map((h) => (
                    <span key={h} className="pointer-events-none absolute inset-y-0 border-l border-border/30" style={{ left: `${((h - hours[0]) / (hours[1] - hours[0])) * 100}%` }} />
                  ))}
                  {pastFrac > 0 && (
                    <div className="pointer-events-none absolute inset-y-0 left-0 bg-muted/60" style={{ width: `${pastFrac * 100}%` }} />
                  )}
                  {pastFrac > 0 && pastFrac < 1 && (
                    <div className="pointer-events-none absolute inset-y-0 z-20 border-l-2 border-rose-500" style={{ left: `${pastFrac * 100}%` }} />
                  )}
                  {blocks.map((b) => (
                    <div
                      key={b.id}
                      title={`${reservationStatusLabel(b.status)} · ${b.who}\n${formatHora(b.start)} a ${formatHora(b.end)}`}
                      className={`absolute inset-y-1.5 z-10 overflow-hidden rounded-md border-2 px-1 text-[10px] font-bold leading-[2rem] ${busyBlockClass(b.status)}`}
                      style={{ left: `${frac(b.start < begin ? begin : b.start) * 100}%`, width: `${(frac(b.end > end ? end : b.end) - frac(b.start < begin ? begin : b.start)) * 100}%` }}
                    >
                      <span className="hidden truncate sm:block">{b.who}</span>
                    </div>
                  ))}
                  {sel && !off && (
                    <div
                      className={`pointer-events-none absolute inset-y-0.5 z-30 rounded-md border-2 ${
                        clash ? "border-rose-600 bg-rose-500/20" : "border-emerald-600 bg-emerald-500/20"
                      }`}
                      style={{ left: `${frac(sel.start) * 100}%`, width: `${Math.max(0.5, (frac(sel.end) - frac(sel.start)) * 100)}%` }}
                    />
                  )}
                  {off && (
                    <div className="absolute inset-0 z-30 flex items-center gap-1.5 bg-muted/80 px-3 text-xs font-bold text-muted-foreground">
                      <Wrench className="h-3.5 w-3.5" /> {off}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
