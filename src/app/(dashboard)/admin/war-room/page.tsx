"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2, Minimize2, RefreshCw, Activity, ShieldAlert,
  Users, Car, Package, DollarSign, Clock,
  Radio, TrendingUp, Building2
} from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";

export default function ExecutiveWarRoomPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  const [stats, setStats] = useState({
    totalFamilies: 14280,
    activeCriticalCases: 18,
    resolvedToday: 42,
    activeVehicles: 21,
    totalVehicles: 24,
    emergencyStockPercent: 92,
    committedBudgetFormatted: "$ 48.250.000",
    territorialAlerts: [
      { id: "1", area: "Hábitat y Vivienda", title: "Entrega de tirantes y chapas - Barrio San Jorge", time: "Hace 4 min", priority: "ALTA" },
      { id: "2", area: "Protección Social", title: "Asistencia alimentaria directa - Barrio Libertad", time: "Hace 12 min", priority: "MEDIA" },
      { id: "3", area: "Niñez y Familia", title: "Intervención de equipo interdisciplinario en territorio", time: "Hace 25 min", priority: "URGENTE" },
      { id: "4", area: "Logística y Flota", title: "Móvil #04 completó recorrido de centros barriales", time: "Hace 34 min", priority: "NORMAL" },
    ]
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
      setCurrentDate(
        now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("muni-emergency-mode");
    if (saved) setIsEmergencyActive(JSON.parse(saved));

    const handleStorage = () => {
      const updated = localStorage.getItem("muni-emergency-mode");
      if (updated) setIsEmergencyActive(JSON.parse(updated));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <div className={`space-y-6 transition-all duration-500 ${isFullscreen ? "p-8 fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto" : ""}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-2xl shrink-0">
            <MunicipalCrest className="h-10 w-10 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
                SALA DE SITUACIÓN • GOBIERNO MUNICIPAL
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
              Tablero de Control Estratégico y Monitoreo en Vivo
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-2xl">
            <Clock className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="text-right">
              <div className="text-lg font-black font-mono tracking-widest text-white leading-none">
                {currentTime || "12:00:00"}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold capitalize mt-0.5">
                {currentDate || "Cargando fecha..."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-slate-700 bg-slate-800/80 text-[10px] font-mono text-slate-300 px-3 py-1.5 rounded-xl">
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin text-blue-400" /> Refresco en {countdown}s
            </Badge>

            <Button
              onClick={toggleFullscreen}
              variant="outline"
              className="rounded-xl h-10 px-4 text-xs font-bold border-slate-700 bg-slate-800 hover:bg-slate-700 text-white"
            >
              {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4 text-blue-400" />}
              {isFullscreen ? "Salir" : "Proyector"}
            </Button>
          </div>
        </div>
      </div>

      {isEmergencyActive && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500 text-amber-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-400 shrink-0" />
            <div>
              <p className="font-black text-sm uppercase tracking-wider">
                CENTRO DE OPERACIONES DE EMERGENCIA CLIMÁTICA (COE) ACTIVADO
              </p>
              <p className="text-xs opacity-80">
                Protocolo de contingencia vigente para cuadrillas de guardia y centros de evacuación.
              </p>
            </div>
          </div>
          <Badge className="bg-amber-500 text-black font-black uppercase text-xs">Alerta Máxima</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="rounded-3xl border-slate-800 bg-slate-900/90 text-white shadow-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vecinos Asistidos</span>
            <div className="p-2 bg-blue-500/15 text-blue-400 rounded-xl">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
            {stats.totalFamilies.toLocaleString("es-AR")}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-2 font-bold">
            <TrendingUp className="h-3 w-3" /> +184 esta semana
          </div>
        </Card>

        <Card className="rounded-3xl border-slate-800 bg-slate-900/90 text-white shadow-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Casos Críticos</span>
            <div className="p-2 bg-rose-500/15 text-rose-400 rounded-xl">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-rose-400">
            {stats.activeCriticalCases}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 font-semibold">
            {stats.resolvedToday} resueltos hoy
          </div>
        </Card>

        <Card className="rounded-3xl border-slate-800 bg-slate-900/90 text-white shadow-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Flota en Calle</span>
            <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl">
              <Car className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
            {stats.activeVehicles} <span className="text-lg text-slate-400">/ {stats.totalVehicles}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-2 font-bold">
            87% Operatividad
          </div>
        </Card>

        <Card className="rounded-3xl border-slate-800 bg-slate-900/90 text-white shadow-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stock Insumos</span>
            <div className="p-2 bg-purple-500/15 text-purple-400 rounded-xl">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-purple-400">
            {stats.emergencyStockPercent}%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 font-semibold">
            Abastecimiento garantizado
          </div>
        </Card>

        <Card className="rounded-3xl border-slate-800 bg-slate-900/90 text-white shadow-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Presupuesto Mes</span>
            <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-400 truncate">
            {stats.committedBudgetFormatted}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 font-semibold">
            64% Comprometido
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl border-slate-800 bg-slate-900 text-white p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Radio className="h-5 w-5 text-rose-500 animate-pulse" />
              <h2 className="text-lg font-black tracking-tight text-white">
                Despachos y Alertas Territoriales en Vivo
              </h2>
            </div>
            <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">
              Canal Oficial Directo
            </Badge>
          </div>

          <div className="space-y-3">
            {stats.territorialAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] font-black uppercase border-none ${
                      alert.priority === 'URGENTE' ? 'bg-rose-500 text-white' :
                      alert.priority === 'ALTA' ? 'bg-amber-500 text-black' : 'bg-blue-600 text-white'
                    }`}>
                      {alert.priority}
                    </Badge>
                    <span className="text-xs font-bold text-slate-400">{alert.area}</span>
                  </div>
                  <p className="text-sm font-bold text-white">{alert.title}</p>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-500 shrink-0">{alert.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-3xl border-slate-800 bg-slate-900 text-white p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-400" />
              Estado de Áreas y Secretarías
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200">Hábitat y Vivienda</span>
                <Badge className="bg-emerald-500/15 text-emerald-400 border-none">100% Cuadrillas Activas</Badge>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[85%]" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200">Protección Social</span>
                <Badge className="bg-blue-500/15 text-blue-400 border-none">Guardia Territorial</Badge>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[92%]" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200">Niñez y Familia</span>
                <Badge className="bg-purple-500/15 text-purple-400 border-none">Atención en Sede</Badge>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full w-[78%]" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
