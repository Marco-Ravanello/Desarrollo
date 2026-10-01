"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2, Minimize2, RefreshCw, Activity, ShieldAlert,
  Users, Car, Package, DollarSign, Clock,
  Radio, TrendingUp, Building2
} from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";

interface WarRoomViewProps {
  initialData: {
    totalCitizens: number;
    activeCriticalCases: number;
    resolvedToday: number;
    activeVehicles: number;
    totalVehicles: number;
    emergencyStockPercent: number;
    committedBudgetFormatted: string;
    territorialAlerts: Array<{
      id: string;
      area: string;
      title: string;
      time: string;
      priority: string;
      status: string;
    }>;
    areaStatus: Array<{
      id: string;
      name: string;
      activeCases: number;
      percentage: number;
      badgeText: string;
    }>;
  };
}

export function WarRoomView({ initialData }: WarRoomViewProps) {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

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
    const saved = localStorage.getItem("muni-emergency-mode") || localStorage.getItem("emergency-mode-active");
    if (saved) setIsEmergencyActive(JSON.parse(saved));

    const handleStorage = () => {
      const updated = localStorage.getItem("muni-emergency-mode") || localStorage.getItem("emergency-mode-active");
      if (updated !== null) setIsEmergencyActive(JSON.parse(updated));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("muni-emergency-toggle", handleStorage);
    window.addEventListener("emergency-toggle", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("muni-emergency-toggle", handleStorage);
      window.removeEventListener("emergency-toggle", handleStorage);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.refresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <div className={`space-y-6 transition-all duration-500 ${isFullscreen ? "p-6 sm:p-8 fixed inset-0 z-50 bg-background text-foreground overflow-y-auto" : ""}`}>
      {/* Header Institucional */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-card border border-border/70 text-card-foreground shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl shrink-0">
            <MunicipalCrest className="h-10 w-10 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                SALA DE SITUACIÓN • GOBIERNO MUNICIPAL
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-0.5">
              Tablero de Control Estratégico y Monitoreo en Vivo
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 bg-muted/60 border border-border/60 px-4 py-2 rounded-2xl">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="text-right">
              <div className="text-lg font-black font-mono tracking-widest text-foreground leading-none">
                {currentTime || "12:00:00"}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold capitalize mt-0.5">
                {currentDate || "Cargando fecha..."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border/60 bg-muted/40 text-[10px] font-mono text-muted-foreground px-3 py-1.5 rounded-xl">
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin text-primary" /> Refresco en {countdown}s
            </Badge>
            <Button
              onClick={toggleFullscreen}
              variant="outline"
              className="rounded-xl h-10 px-4 text-xs font-bold border-border/60 hover:bg-accent text-foreground transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4 text-primary" />}
              {isFullscreen ? "Salir" : "Proyector"}
            </Button>
          </div>
        </div>
      </div>
      {/* Alerta COE si está activa */}
      {isEmergencyActive && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-800 dark:text-amber-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0" />
            <div>
              <p className="font-black text-sm uppercase tracking-wider text-amber-900 dark:text-amber-200">
                CENTRO DE OPERACIONES DE EMERGENCIA CLIMÁTICA (COE) ACTIVADO
              </p>
              <p className="text-xs opacity-90 text-amber-800 dark:text-amber-300">
                Protocolo de contingencia vigente para cuadrillas de guardia y centros de evacuación.
              </p>
            </div>
          </div>
          <Badge className="bg-amber-500 text-black font-black uppercase text-xs">Alerta Máxima</Badge>
        </div>
      )}
      {/* 5 Tarjetas KPI Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="rounded-3xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Vecinos Registrados</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-foreground">
            {initialData.totalCitizens.toLocaleString("es-AR")}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-bold">
            <TrendingUp className="h-3 w-3" /> Datos reales en sistema
          </div>
        </Card>
        <Card className="rounded-3xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Casos Críticos</span>
            <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
            {initialData.activeCriticalCases}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2 font-semibold">
            {initialData.resolvedToday} casilleros cerrados
          </div>
        </Card>
        <Card className="rounded-3xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Flota Disponible</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Car className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-foreground">
            {initialData.activeVehicles} <span className="text-lg text-muted-foreground font-medium">/ {initialData.totalVehicles}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-bold">
            {initialData.totalVehicles > 0 ? `${Math.round((initialData.activeVehicles / initialData.totalVehicles) * 100)}% Operatividad` : "Sin Flota"}
          </div>
        </Card>
        <Card className="rounded-3xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nivel de Stock</span>
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400">
            {initialData.emergencyStockPercent}%
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2 font-semibold">
            Insumos en depósitos
          </div>
        </Card>
        <Card className="rounded-3xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Presupuesto Adjudicado</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
            {initialData.committedBudgetFormatted}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2 font-semibold">
            Órdenes aprobadas
          </div>
        </Card>
      </div>
      {/* 2 Paneles Inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl border-border/60 bg-card text-card-foreground p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-2.5">
              <Radio className="h-5 w-5 text-rose-500 animate-pulse" />
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Casos y Alertas Reales en Vivo
              </h2>
            </div>
            <Badge variant="outline" className="border-border/60 text-muted-foreground text-xs font-bold">
              Base de Datos Oficial
            </Badge>
          </div>
          <div className="space-y-3">
            {initialData.territorialAlerts.length > 0 ? (
              initialData.territorialAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/40 hover:border-border/80 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] font-black uppercase border-none ${
                        alert.priority === 'URGENTE' || alert.priority === 'CRITICA' ? 'bg-rose-500 text-white' :
                        alert.priority === 'ALTA' ? 'bg-amber-500 text-black' : 'bg-primary text-primary-foreground'
                      }`}>
                        {alert.priority}
                      </Badge>
                      <span className="text-xs font-bold text-muted-foreground">{alert.area}</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{alert.title}</p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-muted-foreground shrink-0">{alert.time}</span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground font-medium">
                No hay expedientes o casos registrados en la base de datos actualmente.
              </div>
            )}
          </div>
        </Card>
        <Card className="rounded-3xl border-border/60 bg-card text-card-foreground p-6 shadow-sm space-y-4">
          <div className="border-b border-border/40 pb-4">
            <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Carga de Trabajo por Área
            </h2>
          </div>
          <div className="space-y-4 text-xs">
            {initialData.areaStatus.length > 0 ? (
              initialData.areaStatus.map((area) => (
                <div key={area.id} className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground truncate max-w-[160px]">{area.name}</span>
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none font-bold text-[10px]">{area.badgeText}</Badge>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-500" style={{ width: `${area.percentage}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No hay áreas configuradas en el sistema.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
