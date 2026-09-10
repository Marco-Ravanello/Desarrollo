"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Droplets, Waves, AlertTriangle, ShieldAlert,
  Activity, Users, Zap, Heart, CheckCircle2, Navigation, Send
} from "lucide-react";
import { HydrologicalZone, VulnerableGroupStats } from "@/types/emergency";
import { toast } from "sonner";

interface HydrologicalRiskMapProps {
  zones: HydrologicalZone[];
  vulnerableStats: VulnerableGroupStats;
}

export function HydrologicalRiskMap({
  zones: initialZones,
  vulnerableStats
}: HydrologicalRiskMapProps) {
  const [zones, setZones] = useState<HydrologicalZone[]>(initialZones);
  const [selectedZone, setSelectedZone] = useState<HydrologicalZone | null>(initialZones[0] || null);

  const statusConfigs: Record<HydrologicalZone["status"], { label: string; bg: string; text: string; border: string }> = {
    NORMAL: { label: "Nivel Normal", bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500/30" },
    ALERTA_PREVENTIVA: { label: "Alerta Preventiva", bg: "bg-amber-500/15", text: "text-amber-500", border: "border-amber-500/30" },
    DESBORDE_IMMINENTE: { label: "Desborde Inminente", bg: "bg-orange-500/15", text: "text-orange-500", border: "border-orange-500/30" },
    DESBORDADO: { label: "Cuenca Desbordada", bg: "bg-rose-500/20", text: "text-rose-500", border: "border-rose-500/40" }
  };

  const handleActivatePump = (zoneId: string) => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id === zoneId && z.activePumps < z.totalPumps) {
          return { ...z, activePumps: z.activePumps + 1 };
        }
        return z;
      })
    );
    toast.success("Bomba de desagüe adicional activada remotamente");
  };

  const handleDispatchPreventive = (zoneName: string) => {
    toast.success(`Alerta de evacuación preventiva despachada a Defensa Civil y SAME para ${zoneName}`);
  };

  return (
    <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              Monitoreo Telemétrico de Cuencas y Riesgo Hídrico 3F
              <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/30 text-[10px] font-bold uppercase py-0.5">
                5 Puntos Críticos
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Control de cota de nivel de arroyos, bombas electromecánicas de desagüe y cruce de población en vulnerabilidad social.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Vulnerable Stats banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Población en Zona Inundable</span>
            <p className="text-xl font-black text-foreground">{vulnerableStats.totalInFloodRiskAreas.toLocaleString("es-AR")}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
              <Zap className="h-3 w-3" /> Electrodependientes
            </span>
            <p className="text-xl font-black text-amber-500">{vulnerableStats.electrodependientesCount}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1">
              <Heart className="h-3 w-3" /> Titulares CUD / Discapacidad
            </span>
            <p className="text-xl font-black text-blue-500">{vulnerableStats.disabilityCudCount}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Menores 0-5 Años</span>
            <p className="text-xl font-black text-foreground">{vulnerableStats.minorsUnder5Count}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Adultos Mayores +75</span>
            <p className="text-xl font-black text-foreground">{vulnerableStats.elderlyOver75Count}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Droplets className="h-4 w-4 text-blue-500" /> Puntos Críticos de Monitoreo
            </h4>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {zones.map((zone) => {
                const isSel = selectedZone?.id === zone.id;
                const statusCfg = statusConfigs[zone.status];
                const levelPercentage = Math.min(100, Math.round((zone.waterLevelMeters / zone.criticalThresholdMeters) * 100));

                return (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-3 ${
                      isSel
                        ? "bg-primary/10 border-primary shadow-xs"
                        : "bg-muted/30 border-border/40 hover:border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="font-black text-xs text-foreground leading-tight">{zone.name}</h5>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{zone.basin}</p>
                      </div>
                      <Badge className={`${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border} text-[9px] font-bold`}>
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground">Nivel Hídrico: {zone.waterLevelMeters}m</span>
                        <span className="text-rose-500">Umbral: {zone.criticalThresholdMeters}m</span>
                      </div>
                      <Progress value={levelPercentage} className="h-2 rounded-full" />
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border/20 text-muted-foreground">
                      <span>
                        Bombas: <b className="text-foreground">{zone.activePumps}/{zone.totalPumps} operativas</b>
                      </span>
                      <span>
                        Vulnerables: <b className="text-foreground">{zone.vulnerablePeopleCount} hab.</b>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selectedZone ? (
              <Card className="bg-muted/20 border border-border/50 rounded-3xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Detalle Telemétrico</span>
                    <h3 className="text-xl font-black text-foreground tracking-tight">{selectedZone.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedZone.basin}</p>
                  </div>

                  <Badge className={`${statusConfigs[selectedZone.status].bg} ${statusConfigs[selectedZone.status].text} border ${statusConfigs[selectedZone.status].border} text-xs font-bold py-1 px-3`}>
                    {statusConfigs[selectedZone.status].label}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Cota Actual</span>
                    <p className="text-2xl font-black text-blue-500">{selectedZone.waterLevelMeters} m</p>
                    <p className="text-[10px] text-muted-foreground">Umbral crítico: {selectedZone.criticalThresholdMeters} m</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Plantas de Bombeo</span>
                    <p className="text-2xl font-black text-emerald-500">
                      {selectedZone.activePumps} / {selectedZone.totalPumps}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Bombas de desagüe activas</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Personas Sensibles</span>
                    <p className="text-2xl font-black text-amber-500">{selectedZone.vulnerablePeopleCount}</p>
                    <p className="text-[10px] text-muted-foreground">En área de influencia</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
                  <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Cruce Padronal de Vulnerabilidad en Zona
                  </h5>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-amber-500 font-bold block">Electrodependientes</span>
                      <span className="font-black text-foreground">{selectedZone.cuitElectrodependientes}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-muted-foreground font-bold block">Menores 0-5</span>
                      <span className="font-black text-foreground">{selectedZone.minorsUnder5}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/40">
                      <span className="text-[10px] text-muted-foreground font-bold block">Mayores +75</span>
                      <span className="font-black text-foreground">{selectedZone.elderlyOver75}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => handleActivatePump(selectedZone.id)}
                    disabled={selectedZone.activePumps >= selectedZone.totalPumps}
                    className="flex-1 rounded-2xl h-11 text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <Zap className="h-4 w-4" /> Encender Bomba Adicional
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDispatchPreventive(selectedZone.name)}
                    className="flex-1 rounded-2xl h-11 text-xs font-bold uppercase tracking-wider border-rose-500/30 text-rose-500 hover:bg-rose-500/10 gap-2"
                  >
                    <Send className="h-4 w-4" /> Enviar Cuadrilla Preventiva
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center p-12 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-3xl">
                <p className="text-xs font-bold">Seleccione un punto crítico para ver el detalle de cuenca y bombas.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
