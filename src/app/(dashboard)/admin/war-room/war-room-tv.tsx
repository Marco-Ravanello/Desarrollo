"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CalendarDays, Car, DollarSign, GraduationCap, MapPinned, Minimize2, Package, Radio, RefreshCw, ShieldAlert, Sun, Truck, Users } from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { WarRoomData, WarRoomToday } from "./war-room-view";
import { nextPanelIndex, TODAY_KIND_LABEL, TV_PANELS, TV_ROTATE_SECONDS, type TodayItemKind } from "@/lib/war-room-tv";

const KIND_ICON: Record<TodayItemKind, typeof Car> = { vehiculo: Car, recorrida: MapPinned, entrega: Truck, clase: GraduationCap };

/**
 * Que la tele no se apague ni ponga el protector de pantalla mientras está la Sala de Situación.
 * El navegador suelta el pedido cuando la pestaña queda atrás: al volver se pide de nuevo.
 */
function useScreenAwake(): boolean {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void>; addEventListener: (e: "release", f: () => void) => void }> } };
    if (!nav.wakeLock) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const l = await nav.wakeLock!.request("screen");
        if (cancelled) return void l.release().catch(() => {});
        lock = l;
        setAwake(true);
        l.addEventListener("release", () => setAwake(false));
      } catch {
        setAwake(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
  return awake;
}

/**
 * Sala de Situación para una tele o un proyector: fondo azul institucional, letra grande,
 * sin menú ni enlaces, y la hora a la vista. El botón "Salir" y el puntero se esconden solos
 * si no se mueve el mouse. La pantalla no se apaga y la parte de abajo va pasando sola entre
 * "Expedientes" y "Hoy en la Secretaría" (idea 117); con las flechas se pasa a mano.
 */
export function WarRoomTv({
  data,
  today,
  time,
  date,
  countdown,
  onExit,
}: {
  data: WarRoomData;
  today: WarRoomToday;
  time: string;
  date: string;
  countdown: number;
  onExit: () => void;
}) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awake = useScreenAwake();
  const [panel, setPanel] = useState(0);
  const [panelSeconds, setPanelSeconds] = useState(TV_ROTATE_SECONDS);

  // Pasa a la pantalla siguiente cada TV_ROTATE_SECONDS; con las flechas se cambia a mano.
  useEffect(() => {
    const tick = setInterval(() => {
      setPanelSeconds((s) => {
        if (s <= 1) {
          setPanel((p) => nextPanelIndex(p));
          return TV_ROTATE_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      setPanel((p) => nextPanelIndex(p, e.key === "ArrowRight" ? 1 : -1));
      setPanelSeconds(TV_ROTATE_SECONDS);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const panelId = TV_PANELS[panel].id;

  useEffect(() => {
    const wake = () => {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), 4000);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

  const kpis = [
    {
      label: "Personas en el padrón",
      icon: Users,
      value: data.totalCitizens.toLocaleString("es-AR"),
      note: "Registro Único",
      alert: false,
    },
    {
      label: "Expedientes urgentes",
      icon: ShieldAlert,
      value: String(data.activeCriticalCases),
      note: plural(data.resolvedToday, "expediente cerrado hoy", "expedientes cerrados hoy"),
      alert: data.activeCriticalCases > 0,
    },
    {
      label: "Flota disponible",
      icon: Car,
      value: `${data.activeVehicles}`,
      suffix: `/ ${data.totalVehicles}`,
      note: data.totalVehicles > 0 ? `${Math.round((data.activeVehicles / data.totalVehicles) * 100)} % disponible` : "Sin vehículos cargados",
      alert: false,
    },
    {
      label: "Insumos bajo el mínimo",
      icon: Package,
      value: String(data.suppliesBelowMin),
      note: data.suppliesTotal > 0 ? `De ${plural(data.suppliesTotal, "insumo cargado", "insumos cargados")}` : "Sin insumos cargados",
      alert: data.suppliesBelowMin > 0,
    },
    {
      label: "Presupuesto adjudicado",
      icon: DollarSign,
      value: data.committedBudgetFormatted,
      note: "En órdenes aprobadas",
      alert: false,
    },
  ];

  return (
    <div
      role="region"
      aria-label="Sala de Situación en pantalla completa"
      className={cn(
        "fixed inset-0 z-[60] flex flex-col gap-5 overflow-hidden bg-gradient-to-br from-[#0A1F37] via-[#0E2A49] to-[#163C68] p-6 text-white xl:gap-7 xl:p-10",
        idle && "cursor-none"
      )}
    >
      {/* Encabezado: escudo, nombre y hora */}
      <header className="flex items-center justify-between gap-6 border-b-[3px] border-muni-orange pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <MunicipalCrest className="h-14 w-14 shrink-0 ring-1 ring-white/20 xl:h-16 xl:w-16" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/70 xl:text-base">Desarrollo Humano y Hábitat · Tres de Febrero</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight xl:text-4xl">
              Sala de Situación
              <span className="ml-3 inline-flex translate-y-[-0.2em] items-center gap-2 rounded-full bg-white/10 px-3 py-1 align-middle text-sm font-semibold text-white/90">
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                En vivo
              </span>
            </h1>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-5xl font-bold leading-none tabular-nums tracking-tight xl:text-6xl">{time}</p>
          <p className="mt-1.5 text-base font-semibold text-white/75 xl:text-lg">{date}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-white/50 tabular-nums">
            <RefreshCw className="h-3 w-3" aria-hidden /> Se actualiza en {countdown} s
          </p>
        </div>
      </header>

      {/* Cifras */}
      <div className="grid grid-cols-5 gap-4 xl:gap-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={cn(
              "rounded-3xl p-5 ring-1 ring-inset xl:p-6",
              k.alert ? "bg-muni-orange/15 ring-muni-orange/60" : "bg-white/[0.06] ring-white/10"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white/75 xl:text-base">{k.label}</p>
              <k.icon className={cn("h-6 w-6 shrink-0", k.alert ? "text-muni-orange" : "text-[#9CC3EC]")} aria-hidden />
            </div>
            <p
              className={cn(
                "mt-3 truncate font-heading font-bold leading-none tabular-nums tracking-tight",
                k.label === "Presupuesto adjudicado" ? "text-4xl 2xl:text-5xl" : "text-5xl 2xl:text-7xl",
                k.alert ? "text-muni-orange" : "text-white"
              )}
            >
              {k.value}
              {k.suffix && <span className="ml-2 text-2xl font-semibold text-white/50 xl:text-3xl">{k.suffix}</span>}
            </p>
            <p className="mt-3 truncate text-sm text-white/60 xl:text-base">{k.note}</p>
          </div>
        ))}
      </div>

      {/* Pantallas que van pasando solas */}
      <nav aria-label="Pantallas" className="-mb-1 flex items-center gap-3">
        {TV_PANELS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPanel(i);
              setPanelSeconds(TV_ROTATE_SECONDS);
            }}
            aria-current={i === panel ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muni-orange xl:text-base",
              i === panel ? "bg-white text-[#0E2A49]" : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            {p.label}
            {p.id === "hoy" && today.total > 0 && (
              <span className={cn("rounded-full px-2 text-xs tabular-nums", i === panel ? "bg-[#0E2A49]/10" : "bg-white/15")}>{today.total}</span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs font-medium tabular-nums text-white/45" aria-live="off">
          Cambia en {panelSeconds} s · flechas para pasar
          {awake && " · La pantalla queda prendida"}
        </span>
      </nav>

      {panelId === "hoy" ? (
        <TodayPanel today={today} date={date} />
      ) : (
      <div key="expedientes" className="grid min-h-0 flex-1 grid-cols-3 gap-4 motion-safe:animate-in motion-safe:fade-in xl:gap-6">
        <section className="col-span-2 flex min-h-0 flex-col rounded-3xl bg-white/[0.06] p-5 ring-1 ring-inset ring-white/10 xl:p-6">
          <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold xl:text-2xl">
            <Radio className="h-6 w-6 text-muni-orange" aria-hidden /> Últimos expedientes
          </h2>
          {data.territorialAlerts.length === 0 ? (
            <p className="text-lg text-white/60">Todavía no hay expedientes cargados.</p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-3 overflow-hidden">
              {data.territorialAlerts.map((a) => {
                const urgent = a.priority === "URGENTE" || a.priority === "ALTA";
                return (
                  <li key={a.id} className="flex items-center gap-4 rounded-2xl bg-white/[0.05] px-4 py-3">
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-sm font-bold",
                        urgent ? "bg-muni-orange text-[#0E2A49]" : "bg-white/10 text-white/85"
                      )}
                    >
                      {a.priorityLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold xl:text-xl">{a.title}</p>
                      <p className="truncate text-sm text-white/60 xl:text-base">
                        {a.area}
                        {a.titular ? ` · ${a.titular}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-semibold tabular-nums text-white/70">{a.time}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex min-h-0 flex-col rounded-3xl bg-white/[0.06] p-5 ring-1 ring-inset ring-white/10 xl:p-6">
          <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold xl:text-2xl">
            <Building2 className="h-6 w-6 text-[#9CC3EC]" aria-hidden /> Trabajo por área
          </h2>
          {data.areaStatus.length === 0 ? (
            <p className="text-lg text-white/60">No hay áreas configuradas.</p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-4 overflow-hidden">
              {data.areaStatus.map((area) => (
                <li key={area.id} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-base font-semibold xl:text-lg">{area.name}</span>
                    <span className="shrink-0 text-sm font-semibold text-white/70 xl:text-base">{area.badgeText}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#9CC3EC]" style={{ width: `${area.percentage}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className={cn(
          "fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-opacity hover:bg-white/25 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muni-orange",
          idle ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <Minimize2 className="h-4 w-4" aria-hidden /> Salir (Esc)
      </button>
    </div>
  );
}

/** "Hoy en la Secretaría": vehículos, recorridas, entregas y cursos del día. */
function TodayPanel({ today, date }: { today: WarRoomToday; date: string }) {
  // Mitad en cada columna, para que no quede una sola columna larga.
  const half = Math.ceil(today.items.length / 2);
  const left = today.items.slice(0, half);
  const right = today.items.slice(half);
  const hidden = today.total - today.items.length;
  return (
    <section
      key="hoy"
      aria-labelledby="tv-hoy"
      className="flex min-h-0 flex-1 flex-col rounded-3xl bg-white/[0.06] p-5 ring-1 ring-inset ring-white/10 motion-safe:animate-in motion-safe:fade-in xl:p-6"
    >
      <h2 id="tv-hoy" className="mb-4 flex items-center gap-2.5 text-xl font-bold xl:text-2xl">
        <CalendarDays className="h-6 w-6 text-muni-orange" aria-hidden /> Hoy en la Secretaría
        {date && <span className="text-base font-semibold text-white/55 xl:text-lg">· {date}</span>}
      </h2>
      {today.items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Sun className="h-12 w-12 text-[#9CC3EC]" aria-hidden />
          <p className="text-xl font-semibold text-white/80">Hoy no hay salidas de vehículos, recorridas, entregas ni cursos cargados.</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-6">
          {[left, right].map((col, ci) => (
            <ul key={ci} className="min-h-0 space-y-3 overflow-hidden">
              {col.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl px-4 py-3",
                      item.pending ? "border-2 border-dashed border-white/30 bg-transparent" : "bg-white/[0.05]"
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10" title={TODAY_KIND_LABEL[item.kind]}>
                      <Icon className="h-6 w-6 text-[#9CC3EC]" aria-hidden />
                      <span className="sr-only">{TODAY_KIND_LABEL[item.kind]}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold xl:text-xl">{item.title}</p>
                      <p className="truncate text-sm text-white/60 xl:text-base">
                        {[item.pending ? "Pendiente de aprobación" : null, item.detail].filter(Boolean).join(" · ") || TODAY_KIND_LABEL[item.kind]}
                      </p>
                    </div>
                    <span className="max-w-[40%] shrink-0 truncate text-right text-base font-semibold tabular-nums text-white/75">{item.when}</span>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      )}
      {hidden > 0 && <p className="mt-3 text-sm text-white/55">Y {hidden} más en la Agenda.</p>}
    </section>
  );
}
