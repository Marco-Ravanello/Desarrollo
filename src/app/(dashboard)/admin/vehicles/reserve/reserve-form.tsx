"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarRange, Car, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { RequiredMark, FormActions } from "@/components/ui/form-section";
import { formatReservationRange, reservationStatusLabel } from "@/lib/vehicle-reservations";
import { startOfWeekMonday } from "@/lib/agenda";
import { dayStart, durationLabel, firstConflict, fromLocalInput, toLocalInput, type BusyReservation } from "@/lib/vehicle-grid";
import { ReservationWeek } from "@/components/vehicles/reservation-week";
import { FreeVehiclesDay, type VehicleRow } from "@/components/vehicles/free-vehicles-day";
import { createVehicleReservationAction } from "../../actions/vehicle-actions";

type Vehicle = VehicleRow & { reservations: (BusyReservation & { user?: { name?: string | null } | null })[] };

const LEGEND = [
  { label: "Aprobada", cls: "border-blue-500/50 bg-blue-500/15" },
  { label: "Pendiente", cls: "border-dashed border-amber-500/60 bg-amber-500/15" },
  { label: "En uso", cls: "border-violet-500/50 bg-violet-500/15" },
  { label: "Tu pedido", cls: "border-emerald-600 bg-emerald-500/25" },
];

export function ReserveVehicleForm({ vehicleId, vehicles }: { vehicleId: string; vehicles: Vehicle[] }) {
  const router = useRouter();
  const available = useMemo(() => vehicles.filter((v) => v.status === "DISPONIBLE"), [vehicles]);
  const [loading, setLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    available.some((v) => v.id === vehicleId) ? vehicleId : available[0]?.id || vehicles[0]?.id || ""
  );
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [view, setView] = useState<"semana" | "libres">("semana");
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [freeDay, setFreeDay] = useState(() => dayStart(new Date()));
  // La grilla depende de la hora del navegador: se dibuja recién en el navegador (igual que la Agenda).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const reservations = vehicle?.reservations ?? [];
  const start = fromLocalInput(startStr);
  const end = fromLocalInput(endStr);
  const selection = start && end && end > start ? { start, end } : null;
  const conflict = selection ? firstConflict(reservations, selection.start, selection.end) : null;
  const unavailable =
    vehicle && vehicle.status !== "DISPONIBLE"
      ? `El ${vehicle.plate} está ${vehicle.status === "EN_TALLER" ? "en el taller" : "fuera de servicio"}: no se puede reservar. Elegí otro.`
      : !vehicle
        ? "No hay vehículos para reservar."
        : null;

  const setRange = (s: Date, e: Date) => {
    setStartStr(toLocalInput(s));
    setEndStr(toLocalInput(e));
  };

  /** Al escribir una fecha a mano, la grilla va a esa semana y a ese día. */
  const jumpTo = (v: string) => {
    const d = fromLocalInput(v);
    if (!d) return;
    setWeekStart(startOfWeekMonday(d));
    setFreeDay(dayStart(d));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (unavailable) return toast.error(unavailable);
    if (!selection) {
      return toast.error(start && end ? "La vuelta tiene que ser después de la salida." : "Elegí el horario en la grilla o escribí la salida y la vuelta.");
    }
    if (selection.start.getTime() < Date.now() - 5 * 60_000) return toast.error("La salida ya pasó. Elegí un horario que venga.");
    if (conflict) return toast.error("Ese horario se pisa con otra reserva. Elegí otro horario u otro vehículo.");

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("vehicleId", selectedVehicleId);
    formData.set("startDate", startStr);
    formData.set("endDate", endStr);
    const res = await createVehicleReservationAction(formData).catch(() => null);
    setLoading(false);
    if (res?.success) {
      toast.success("Listo, se mandó el pedido de reserva.");
      router.push("/admin/vehicles");
    } else {
      toast.error(res?.error || "No se pudo mandar el pedido. Probá de nuevo.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0 space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="vehicleId" className="text-xs font-bold text-muted-foreground">
              Vehículo
            </Label>
            <Combobox
              name="vehicleId"
              value={selectedVehicleId}
              placeholder="Buscar por patente, marca o modelo…"
              options={available.map((v) => ({ value: v.id, label: `${v.plate} · ${v.brand ?? ""} ${v.model ?? ""}`.trim() }))}
              onValueChange={(val: string) => setSelectedVehicleId(val)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/30 p-1" role="tablist" aria-label="Cómo ver los horarios">
            {(
              [
                ["semana", "Semana del vehículo", CalendarRange],
                ["libres", "¿Cuál está libre?", Car],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => {
                  setView(key);
                  if (key === "libres" && selection) setFreeDay(dayStart(selection.start));
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  view === key ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`h-3 w-5 rounded border-2 ${l.cls}`} /> {l.label}
            </span>
          ))}
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          <span className="hidden md:inline">Arrastrá en la grilla desde la hora de salida hasta la de vuelta. Para varios días, escribí las fechas en Tu pedido.</span>
          <span className="md:hidden">Tocá la hora de salida y después la de vuelta. Para varios días, escribí las fechas abajo.</span>
        </p>

        {!mounted ? (
          <div className="h-[640px] animate-pulse rounded-2xl border border-border/60 bg-muted/30" aria-label="Cargando los horarios" />
        ) : view === "semana" ? (
          <ReservationWeek
            reservations={reservations}
            selection={selection}
            conflict={Boolean(conflict)}
            onSelect={setRange}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            disabledMessage={unavailable}
          />
        ) : (
          <FreeVehiclesDay
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            selection={selection}
            day={freeDay}
            onDayChange={setFreeDay}
            onPick={(id, range) => {
              setSelectedVehicleId(id);
              if (range) setRange(range.start, range.end);
            }}
          />
        )}
      </section>

      <form onSubmit={handleSubmit} className="space-y-5 self-start rounded-2xl border border-border/60 bg-card p-5 shadow-xs xl:sticky xl:top-24">
        <div>
          <h2 className="text-lg font-bold text-foreground">Tu pedido</h2>
          <p className="text-xs text-muted-foreground">
            {vehicle ? (
              <>
                <span className="font-bold tabular-nums text-foreground">{vehicle.plate}</span> · {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
              </>
            ) : (
              "Elegí un vehículo."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="space-y-1.5">
            <Label htmlFor="startDate" className="text-xs font-bold text-muted-foreground">
              Salida <RequiredMark />
            </Label>
            <Input
              id="startDate"
              name="startDate"
              type="datetime-local"
              step={1800}
              value={startStr}
              onChange={(e) => {
                setStartStr(e.target.value);
                jumpTo(e.target.value);
              }}
              required
              className={`rounded-xl text-sm ${conflict ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate" className="text-xs font-bold text-muted-foreground">
              Vuelta <RequiredMark />
            </Label>
            <Input
              id="endDate"
              name="endDate"
              type="datetime-local"
              step={1800}
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              required
              className={`rounded-xl text-sm ${conflict ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
            />
          </div>
        </div>

        {selection && !conflict && (
          <p className="rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {formatReservationRange(selection.start, selection.end)} · {durationLabel(selection.start, selection.end)}
          </p>
        )}

        {conflict && (
          <div className="space-y-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <p className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Se pisa con otra reserva
            </p>
            <p>
              {conflict.user?.name || "Otra persona"} lo tiene {formatReservationRange(conflict.startDate, conflict.endDate)} (
              {reservationStatusLabel(conflict.status).toLowerCase()}). Cambiá el horario o probá en &quot;¿Cuál está libre?&quot;.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-xs font-bold text-muted-foreground">
            Para qué y adónde <RequiredMark />
          </Label>
          <Input id="reason" name="reason" placeholder="Por ejemplo: llevar insumos al barrio San Martín" required className="rounded-xl text-sm" />
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-xs leading-relaxed text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Esto manda un pedido. Te avisamos en la campana cuando quien maneja la flota lo apruebe o lo rechace.
        </p>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || Boolean(conflict) || Boolean(unavailable)}>
            {loading ? "Mandando…" : "Pedir reserva"}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
