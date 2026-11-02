"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Car, DollarSign, Minimize2, Package, Radio, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { WarRoomData } from "./war-room-view";

/**
 * Sala de Situación para una tele o un proyector: fondo azul institucional, letra grande,
 * sin menú ni enlaces, y la hora a la vista. El botón "Salir" y el puntero se esconden solos
 * si no se mueve el mouse.
 */
export function WarRoomTv({
  data,
  time,
  date,
  countdown,
  emergency,
  onExit,
}: {
  data: WarRoomData;
  time: string;
  date: string;
  countdown: number;
  emergency: boolean;
  onExit: () => void;
}) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      {emergency && (
        <div className="flex items-center gap-4 rounded-2xl bg-muni-orange px-6 py-4 text-[#0E2A49]">
          <ShieldAlert className="h-8 w-8 shrink-0" />
          <p className="text-xl font-bold xl:text-2xl">Emergencia climática activa: protocolo de contingencia vigente</p>
        </div>
      )}

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
                k.label === "Presupuesto adjudicado" ? "text-4xl xl:text-5xl" : "text-5xl xl:text-7xl",
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

      {/* Expedientes y áreas */}
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 xl:gap-6">
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
