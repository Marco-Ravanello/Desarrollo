"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CloudLightning, Wind, Droplets, AlertTriangle, ShieldAlert,
  RotateCw, Eye, Sparkles, Navigation, Radio, MapPin, Gauge
} from "lucide-react";
import {
  SMNAlertLevel,
  SMNAlertInfo,
  RadarEchoCell,
  RadarAtmosphericMetrics
} from "@/types/emergency";
import { toast } from "sonner";

interface WeatherRadarWidgetProps {
  alert: SMNAlertInfo;
  cells: RadarEchoCell[];
  metrics: RadarAtmosphericMetrics;
  lastSweep: string;
}

export function WeatherRadarWidget({
  alert: initialAlert,
  cells: initialCells,
  metrics: initialMetrics,
  lastSweep
}: WeatherRadarWidgetProps) {
  const [activeAlertLevel, setActiveAlertLevel] = useState<SMNAlertLevel>(initialAlert.level);
  const [radarMode, setViewMode] = useState<"reflectivity" | "doppler" | "accumulated">("reflectivity");
  const [selectedCell, setSelectedCell] = useState<RadarEchoCell | null>(initialCells[0] || null);
  const [isSweeping, setIsSweeping] = useState(true);

  const alertLevelConfigs: Record<SMNAlertLevel, { label: string; bg: string; text: string; border: string }> = {
    VERDE: { label: "Nivel Verde - Sin Riesgo", bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30" },
    AMARILLO: { label: "Alerta Amarilla - SMN SAT", bg: "bg-amber-500/15", text: "text-amber-500", border: "border-amber-500/30" },
    NARANJA: { label: "Alerta Naranja - Tormenta Severa", bg: "bg-orange-500/15", text: "text-orange-500", border: "border-orange-500/30" },
    ROJO: { label: "Alerta Roja - Emergencia Meteorológica", bg: "bg-rose-500/20", text: "text-rose-500", border: "border-rose-500/40" }
  };

  const handleSimulateAlert = (lvl: SMNAlertLevel) => {
    setActiveAlertLevel(lvl);
    toast.info(`Nivel de Alerta SMN simular activado: ${lvl}`);
  };

  return (
    <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                Radar Meteorológico Doppler SMN SAT
                <Badge className={`${alertLevelConfigs[activeAlertLevel].bg} ${alertLevelConfigs[activeAlertLevel].text} border ${alertLevelConfigs[activeAlertLevel].border} text-[10px] font-black uppercase py-0.5`}>
                  {alertLevelConfigs[activeAlertLevel].label}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Consola táctica de telemetría de reflectividad (dBZ), celdas de ecoradar y seguimiento en tiempo real.
              </CardDescription>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-2xl border border-border/40">
          {(["VERDE", "AMARILLO", "NARANJA", "ROJO"] as SMNAlertLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => handleSimulateAlert(lvl)}
              className={`text-[10px] font-black px-2.5 py-1 rounded-xl transition-all ${
                activeAlertLevel === lvl
                  ? `${alertLevelConfigs[lvl].bg} ${alertLevelConfigs[lvl].text} border ${alertLevelConfigs[lvl].border} shadow-2xs`
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 relative bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-inner flex flex-col items-center justify-center overflow-hidden min-h-[380px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950" />

            {/* SVG Radar Visualizer */}
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full border border-emerald-500/20 flex items-center justify-center">
              <div className="absolute w-56 h-56 rounded-full border border-emerald-500/15" />
              <div className="absolute w-36 h-36 rounded-full border border-emerald-500/15" />
              <div className="absolute w-16 h-16 rounded-full border border-emerald-500/20" />

              <div className="absolute w-full h-[1px] bg-emerald-500/20" />
              <div className="absolute h-full w-[1px] bg-emerald-500/20" />

              {/* Animated Sweep Radar Line */}
              {isSweeping && (
                <div className="absolute w-full h-full rounded-full animate-spin [animation-duration:4s] pointer-events-none bg-[conic-gradient(from_0deg_at_50%_50%,rgba(16,185,129,0)_0deg,rgba(16,185,129,0.3)_300deg,rgba(16,185,129,0.7)_360deg)]" />
              )}

              {/* Center Dot - Tres de Febrero COE */}
              <div className="relative z-20 flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg animate-pulse" />
                <span className="text-[9px] font-black text-blue-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-blue-500/30 mt-1">
                  COE Caseros
                </span>
              </div>

              {/* Cell Dots overlay */}
              {initialCells.map((cell) => {
                const isSelected = selectedCell?.id === cell.id;
                const angleRad = (cell.bearingDeg * Math.PI) / 180;
                const radiusPx = (cell.distanceKm / 35) * 120; // Scale 35km to circle radius
                const x = Math.sin(angleRad) * radiusPx;
                const y = -Math.cos(angleRad) * radiusPx;

                const colorDbz =
                  cell.reflectivityDbz >= 55
                    ? "bg-purple-500 border-purple-300 animate-ping"
                    : cell.reflectivityDbz >= 45
                    ? "bg-rose-500 border-rose-300"
                    : cell.reflectivityDbz >= 35
                    ? "bg-amber-500 border-amber-300"
                    : "bg-emerald-500 border-emerald-300";

                return (
                  <div
                    key={cell.id}
                    onClick={() => setSelectedCell(cell)}
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                    className="absolute z-30 cursor-pointer group"
                    title={`${cell.name} (${cell.reflectivityDbz} dBZ)`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 ${colorDbz} shadow-lg transition-transform group-hover:scale-125`} />
                    {isSelected && (
                      <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded border border-slate-700 whitespace-nowrap z-40">
                        {cell.name} • {cell.reflectivityDbz} dBZ
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scale Bar dBZ */}
            <div className="mt-4 z-20 flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800 text-[10px] font-black text-slate-300">
              <span className="text-slate-400">Reflectividad dBZ:</span>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">15-30</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">30-40</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">40-50</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">50-60</span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">60+ Granizo</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-primary" /> Celdas de Tormenta e Inspección de Eco
            </h4>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {initialCells.map((cell) => {
                const isSel = selectedCell?.id === cell.id;
                return (
                  <div
                    key={cell.id}
                    onClick={() => setSelectedCell(cell)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                      isSel
                        ? "bg-primary/10 border-primary shadow-xs"
                        : "bg-muted/30 border-border/40 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-foreground">{cell.name}</span>
                      <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold text-[10px]">
                        {cell.reflectivityDbz} dBZ
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Distancia: <b>{cell.distanceKm} km</b> rumbo <b>{cell.direction}</b>. Llegada estimada a 3F en <b>{cell.estimatedArrivalMinutes} min</b>.
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-border/20">
                      {cell.affectedNeighborhoods.map((n, idx) => (
                        <Badge key={idx} variant="outline" className="text-[9px] border-border/40 text-muted-foreground">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedCell && (
              <Button
                variant="outline"
                onClick={() => toast.success(`Despacho preventivo emitido para ${selectedCell.affectedNeighborhoods.join(", ")}`)}
                className="w-full rounded-2xl h-10 text-xs font-bold border-rose-500/30 text-rose-500 hover:bg-rose-500/10 gap-2"
              >
                <AlertTriangle className="h-4 w-4" /> Despachar Cuadrillas a Zona de Eco
              </Button>
            )}
          </div>
        </div>

        {/* Atmospheric Metrics bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-border/40">
          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Temperatura Superficie</span>
            <p className="text-base font-black text-foreground">{initialMetrics.surfaceTempC}°C</p>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Humedad Relativa</span>
            <p className="text-base font-black text-foreground">{initialMetrics.humidityPercent}%</p>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Presión Atmosférica</span>
            <p className="text-base font-black text-foreground">{initialMetrics.pressureHpa} hPa</p>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Ráfagas Máximas</span>
            <p className="text-base font-black text-amber-500">{initialMetrics.windGustsKmH} km/h</p>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Punto de Rocío</span>
            <p className="text-base font-black text-foreground">{initialMetrics.dewPointC}°C</p>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Lluvia Acum. 24hs</span>
            <p className="text-base font-black text-blue-500">{initialMetrics.accumulatedRain24hMm} mm</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
