"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, ArrowUpRight, Flame, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

// Centroids of the 13 official Tres de Febrero localities
const T3F_LOCALITIES = [
  { name: "Caseros", lat: -34.6083, lng: -58.5642 },
  { name: "Ciudadela", lat: -34.6367, lng: -58.5411 },
  { name: "Villa Bosch", lat: -34.5889, lng: -58.5833 },
  { name: "Santos Lugares", lat: -34.6000, lng: -58.5486 },
  { name: "Sáenz Peña", lat: -34.6086, lng: -58.5361 },
  { name: "Loma Hermosa", lat: -34.5622, lng: -58.5989 },
  { name: "Martín Coronado", lat: -34.5833, lng: -58.5917 },
  { name: "El Palomar", lat: -34.6067, lng: -58.5917 },
  { name: "Pablo Podestá", lat: -34.5722, lng: -58.6083 },
  { name: "José Ingenieros", lat: -34.6222, lng: -58.5389 },
  { name: "Villa Raffo", lat: -34.6194, lng: -58.5278 },
  { name: "Churruca", lat: -34.5667, lng: -58.6167 },
  { name: "Once de Septiembre", lat: -34.5611, lng: -58.6222 }
];

function findNearestLocality(lat: number, lng: number): string {
  let minDistanceSq = Infinity;
  let nearest = "Caseros";

  T3F_LOCALITIES.forEach((loc) => {
    const dLat = lat - loc.lat;
    const dLng = lng - loc.lng;
    const distSq = dLat * dLat + dLng * dLng;

    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      nearest = loc.name;
    }
  });

  return nearest;
}

export function MiniHeatmapWidget({ peopleLocations = [] }: MiniHeatmapWidgetProps) {
  const router = useRouter();

  const localityCounts: Record<string, number> = {};

  peopleLocations.forEach((p) => {
    let locName = p.neighborhood?.trim();

    if (!locName || locName === "Zona Registrada" || locName === "S/D") {
      if (p.latitude && p.longitude) {
        locName = findNearestLocality(p.latitude, p.longitude);
      } else {
        locName = "Caseros";
      }
    } else {
      // Normalize neighborhood to match closest official locality name if possible
      const matched = T3F_LOCALITIES.find(
        (l) => l.name.toLowerCase() === locName?.toLowerCase()
      );
      if (matched) {
        locName = matched.name;
      }
    }

    localityCounts[locName] = (localityCounts[locName] || 0) + 1;
  });

  const sortedLocalities = Object.entries(localityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const pointCount = peopleLocations.length;

  return (
    <Card className="bg-card/60 backdrop-blur-md border border-white/[0.06] shadow-xl overflow-hidden flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <Flame className="h-4 w-4 text-rose-400 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground">Densidad Socio-Barrial</CardTitle>
            <CardDescription className="text-xs">
              Distribución territorial de demandas en las 13 localidades.
            </CardDescription>
          </div>
        </div>

        <Link href="/maps?view=heatmap">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 border-white/10 hover:bg-accent hover:text-accent-foreground"
          >
            <span>Ver Mapa Completo</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
        <div className="relative rounded-xl overflow-hidden border border-white/[0.08] shadow-inner">
          <DynamicMiniHeatmap locations={peopleLocations} />

          {/* Floating Badge for Georeferenced Point Count */}
          <div className="absolute top-2 right-2 z-[400] flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/85 backdrop-blur-md border border-border/60 text-[10px] font-black uppercase text-foreground shadow-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>● {pointCount} Puntos Georreferenciados</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Concentración por Localidad 3F
            </p>
            <Link href="/maps" className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
              Filtro GIS <Layers className="h-3 w-3" />
            </Link>
          </div>

          {sortedLocalities.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sortedLocalities.map(([loc, count], idx) => {
                const colorClass = idx === 0
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                  : idx === 1
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                  : idx === 2
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20";

                return (
                  <Badge
                    key={loc}
                    variant="secondary"
                    className={`text-xs border px-2.5 py-1 font-semibold cursor-pointer transition-all ${colorClass}`}
                    onClick={() => router.push(`/maps?locality=${encodeURIComponent(loc)}`)}
                  >
                    📍 {loc} ({count})
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
