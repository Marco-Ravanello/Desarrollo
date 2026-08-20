"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, ArrowUpRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DynamicMiniHeatmap = dynamic(
  () => import("./mini-heatmap-inner").then((mod) => mod.MiniHeatmapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] w-full bg-muted/30 animate-pulse rounded-xl flex flex-col items-center justify-center gap-2 border border-border/50">
        <MapPin className="h-6 w-6 text-muted-foreground opacity-40 animate-bounce" />
        <span className="text-xs text-muted-foreground font-medium">Cargando mapa socio-barrial...</span>
      </div>
    )
  }
);

interface LocationItem {
  id: string;
  latitude: number;
  longitude: number;
  neighborhood?: string;
  address?: string;
}

interface MiniHeatmapWidgetProps {
  peopleLocations?: LocationItem[];
}

export function MiniHeatmapWidget({ peopleLocations = [] }: MiniHeatmapWidgetProps) {
  const router = useRouter();

  const neighborhoodCounts: Record<string, number> = {};
  peopleLocations.forEach((p) => {
    const rawZone = p.neighborhood || p.address || "Zona Registrada";
    const cleanZone = rawZone.split(",")[0].trim();
    neighborhoodCounts[cleanZone] = (neighborhoodCounts[cleanZone] || 0) + 1;
  });

  const topNeighborhoods = Object.entries(neighborhoodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const hasRealLocations = peopleLocations.length > 0;

  return (
    <Card className="bg-card/60 backdrop-blur-md border border-white/[0.06] shadow-xl overflow-hidden flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <Flame className="h-4 w-4 text-rose-400 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground">Densidad Socio-Barrial</CardTitle>
            <CardDescription className="text-xs">Distribución territorial de demandas en tiempo real.</CardDescription>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/maps?view=heatmap")}
          className="h-8 text-xs gap-1 border-white/10 hover:bg-accent hover:text-accent-foreground"
        >
          <span>Ver Mapa GIS</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
        <div className="relative rounded-xl overflow-hidden border border-white/[0.08] shadow-inner">
          <DynamicMiniHeatmap locations={peopleLocations} />
          {hasRealLocations && (
            <div className="absolute bottom-2 left-2 z-[400] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/80 backdrop-blur-md border border-border/60 text-[11px] font-semibold text-foreground shadow-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Zonas con Puntos Registrados</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Zonas de Mayor Asistencia</p>

          {hasRealLocations && topNeighborhoods.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topNeighborhoods.map(([zone, count], idx) => {
                const colorClass = idx === 0
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                  : idx === 1
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20";
                return (
                  <Badge
                    key={zone}
                    variant="secondary"
                    className={`text-xs border px-2.5 py-1 font-medium cursor-pointer transition-colors ${colorClass}`}
                    onClick={() => router.push("/maps?view=heatmap")}
                  >
                    📍 {zone} ({count} {count === 1 ? "registro" : "registros"})
                  </Badge>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-center space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Sin registros geolocalizados en la BD</p>
              <p className="text-[10px] text-muted-foreground/60">
                Al registrar ciudadanos con dirección o coordenadas GPS, las zonas de mayor demanda se calcularán automáticamente.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
