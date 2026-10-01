"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Compass, MapPin, ChevronRight } from "lucide-react";

const DynamicTerritorialMap = dynamic(
  () => import("./territorial-map-inner").then((mod) => mod.TerritorialMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] w-full bg-muted/40 animate-pulse rounded-2xl flex flex-col items-center justify-center gap-2 border border-border/50">
        <MapPin className="h-6 w-6 text-blue-600 animate-bounce" />
        <span className="text-xs text-muted-foreground font-semibold">Cargando cartografía oficial de Tres de Febrero...</span>
      </div>
    )
  }
);

interface LocationPoint {
  id?: string;
  latitude: number;
  longitude: number;
  neighborhood?: string;
  address?: string;
}

interface TerritorialActivityWidgetProps {
  topArea?: string;
  locations?: LocationPoint[];
}

export function TerritorialActivityWidget({
  topArea = "Caseros",
  locations = []
}: TerritorialActivityWidgetProps) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card text-card-foreground shadow-xs p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Compass className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Actividad territorial</h3>
        </div>
        <Link
          href="/maps"
          className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          Ver mapa completo <span className="text-sm">→</span>
        </Link>
      </div>

      {/* Real Cartographic Map Canvas with Floating Legend */}
      <div className="relative w-full h-[220px] rounded-2xl overflow-hidden border border-border/50 bg-[#EEF5FC] dark:bg-slate-900/60 my-2">
        {/* Floating Legend */}
        <div className="absolute top-2.5 right-2.5 z-20 bg-card/90 dark:bg-card/90 backdrop-blur-md border border-border/60 rounded-xl px-2.5 py-1.5 shadow-xs space-y-1 text-[10px] font-medium text-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
            <span>Casos activos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
            <span>Familias registradas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Intervenciones</span>
          </div>
        </div>

        {/* Real Leaflet Map */}
        <DynamicTerritorialMap locations={locations} topArea={topArea} />
      </div>

      {/* Footer bar: Zona con mayor actividad */}
      <Link
        href="/maps"
        className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/40 mt-1 group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block leading-none">
              Zona con mayor actividad
            </span>
            <span className="text-xs font-black text-foreground truncate block mt-0.5">
              {topArea}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 hidden sm:inline-block">
            13 localidades
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </div>
  );
}
