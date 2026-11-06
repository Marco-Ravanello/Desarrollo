"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaseTag } from "@/components/cases/case-tag";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_TONE, toneOf } from "@/lib/status-tones";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Maximize2, RefreshCw, Activity, ShieldAlert,
  Users, Car, Package, DollarSign, Clock,
  Radio, Building2, Tv
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { plural } from "@/lib/formato";
import { TZ_AR, formatFechaLarga } from "@/lib/fechas";
import { WarRoomTv } from "./war-room-tv";
import type { TodayItem } from "@/lib/war-room-tv";

export type WarRoomToday = { today: string; items: TodayItem[]; total: number };

interface WarRoomViewProps {
  /** "Hoy en la Secretaría", para la tele (idea 117). */
  today?: WarRoomToday;
  initialData: {
    totalCitizens: number;
    activeCriticalCases: number;
    resolvedToday: number;
    activeVehicles: number;
    totalVehicles: number;
    suppliesBelowMin: number;
    suppliesTotal: number;
    committedBudgetFormatted: string;
    committedBudgetFull: string;
    territorialAlerts: Array<{
      id: string;
      area: string;
      title: string;
      tag: string | null;
      titular: string | null;
      time: string;
      priority: string;
      priorityLabel: string;
      status: string;
    }>;
    areaStatus: Array<{
      id: string;
      name: string;
      fullName: string;
      activeCases: number;
      percentage: number;
      badgeText: string;
    }>;
  };
}

export type WarRoomData = WarRoomViewProps["initialData"];

const KPI_NUMBER = "font-heading text-3xl sm:text-4xl font-bold tracking-tight tabular-nums";
/** Azul institucional para las cifras; naranja solo para lo que pide atención. */
const NUM_CALM = "text-[#163C68] dark:text-blue-100";
const NUM_ALERT = "text-[#C2410C] dark:text-muni-orange";
const ICON_CALM = "p-2 rounded-xl bg-[#E0EEFF] text-[#163C68] dark:bg-white/10 dark:text-blue-200";
const ICON_ALERT = "p-2 rounded-xl bg-orange-500/10 text-[#C2410C] dark:text-muni-orange";

export function WarRoomView({ initialData, today }: WarRoomViewProps) {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: TZ_AR })
      );
      setCurrentDate(
        (() => { const t = formatFechaLarga(now); return t.charAt(0).toUpperCase() + t.slice(1); })()
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
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

  // Pantalla completa para una tele o un proyector. Con ?tele=1 en la dirección arranca así
  // (útil para dejar una tele fija); el navegador solo deja ocupar toda la pantalla tras un clic.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tele") === "1") setIsFullscreen(true);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  const enterFullscreen = () => {
    setIsFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {
      // Si el navegador no lo permite, igual queda la vista grande dentro de la ventana.
    });
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  if (isFullscreen) {
    return (
      <WarRoomTv
        data={initialData}
        today={today ?? { today: "", items: [], total: 0 }}
        time={currentTime}
        date={currentDate}
        countdown={countdown}
        onExit={exitFullscreen}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Institucional */}
      <PageHeader
        title="Sala de Situación"
        icon={Tv}
        description={
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            En vivo: lo que está pasando ahora en la Secretaría.
          </span>
        }
        actions={
          <>
            <div className="flex items-center gap-3 bg-muted/60 border border-border/60 px-4 py-2 rounded-2xl">
              <Clock className="h-5 w-5 text-muni-orange shrink-0" />
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums tracking-tight text-foreground leading-none">
                  {currentTime || "12:00:00"}
                </div>
                <div className="text-xs text-muted-foreground font-semibold mt-0.5">
                  {currentDate || "Cargando fecha..."}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="border-border/60 bg-muted/40 text-xs text-muted-foreground tabular-nums px-3 py-1.5">
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin text-primary motion-reduce:animate-none" /> Se actualiza en {countdown} s
            </Badge>
            <Button
              onClick={enterFullscreen}
              variant="outline"
              className="rounded-xl h-10 px-4 text-xs font-bold gap-2"
              title="Para verla en una tele o un proyector: letra grande, sin menú y con la hora"
            >
              <Maximize2 className="h-4 w-4 text-primary" /> Pantalla completa
            </Button>
          </>
        }
      />
      {/* 5 Tarjetas KPI Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="rounded-2xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-muted-foreground">Personas en el padrón</span>
            <div className={ICON_CALM}>
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className={`${KPI_NUMBER} ${NUM_CALM}`}>
            {initialData.totalCitizens.toLocaleString("es-AR")}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-semibold">
            Registro Único
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-muted-foreground">Expedientes urgentes</span>
            <div className={initialData.activeCriticalCases > 0 ? ICON_ALERT : ICON_CALM}>
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className={`${KPI_NUMBER} ${initialData.activeCriticalCases > 0 ? NUM_ALERT : NUM_CALM}`}>
            {initialData.activeCriticalCases}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-semibold">
            {plural(initialData.resolvedToday, "expediente cerrado hoy", "expedientes cerrados hoy")}
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-muted-foreground">Flota disponible</span>
            <div className={ICON_CALM}>
              <Car className="h-4 w-4" />
            </div>
          </div>
          <div className={`${KPI_NUMBER} ${NUM_CALM}`}>
            {initialData.activeVehicles} <span className="text-lg text-muted-foreground font-medium">/ {initialData.totalVehicles}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-semibold">
            {initialData.totalVehicles > 0 ? `${Math.round((initialData.activeVehicles / initialData.totalVehicles) * 100)} % disponible` : "Sin vehículos cargados"}
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-muted-foreground">Insumos bajo el mínimo</span>
            <div className={initialData.suppliesBelowMin > 0 ? ICON_ALERT : ICON_CALM}>
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className={`${KPI_NUMBER} ${initialData.suppliesBelowMin > 0 ? NUM_ALERT : NUM_CALM}`}>
            {initialData.suppliesBelowMin}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-semibold">
            {initialData.suppliesTotal > 0 ? `De ${plural(initialData.suppliesTotal, "insumo cargado", "insumos cargados")}` : "Sin insumos cargados"}
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-muted-foreground">Presupuesto adjudicado</span>
            <div className={ICON_CALM}>
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className={`font-heading text-2xl sm:text-3xl font-bold tracking-tight tabular-nums truncate ${NUM_CALM}`} title={initialData.committedBudgetFull}>
            {initialData.committedBudgetFormatted}
          </div>
          <div className="text-xs text-muted-foreground mt-2 font-semibold">
            {initialData.committedBudgetFull} en órdenes aprobadas
          </div>
        </Card>
      </div>
      {/* 2 Paneles Inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border-border/60 bg-card text-card-foreground p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-2.5">
              <Radio className="h-5 w-5 text-muni-orange animate-pulse motion-reduce:animate-none" />
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Últimos expedientes
              </h2>
            </div>
          </div>
          <div className="space-y-3">
            {initialData.territorialAlerts.length > 0 ? (
              initialData.territorialAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/cases/${alert.id}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40 hover:border-border/80 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={toneOf(PRIORITY_TONE, alert.priority)}>{alert.priorityLabel}</StatusBadge>
                      <CaseTag tag={alert.tag} />
                      <span className="text-xs font-bold text-muted-foreground">{alert.area}</span>
                    </div>
                    <p className="truncate text-sm font-bold text-foreground" title={alert.title}>{alert.title}</p>
                    {alert.titular && <p className="truncate text-xs text-muted-foreground">{alert.titular}</p>}
                  </div>
                  <span className="text-xs tabular-nums font-semibold text-muted-foreground shrink-0">{alert.time}</span>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground font-medium">
                Todavía no hay expedientes cargados.
              </div>
            )}
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card text-card-foreground p-6 shadow-sm space-y-4">
          <div className="border-b border-border/40 pb-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Trabajo por área
            </h2>
          </div>
          <div className="space-y-4 text-xs">
            {initialData.areaStatus.length > 0 ? (
              initialData.areaStatus.map((area) => (
                <div key={area.id} className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-bold text-foreground" title={area.fullName}>{area.name}</span>
                    <span className="shrink-0 font-semibold text-muted-foreground">{area.badgeText}</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-[#163C68] dark:bg-blue-300 h-full transition-all duration-500" style={{ width: `${area.percentage}%` }} />
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
