"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Compass, MapPin, ChevronRight, ArrowUpRight } from "lucide-react";

const DynamicTerritorialMap = dynamic(
  () => import("./territorial-map-inner").then((mod) => mod.TerritorialMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] w-full bg-muted/30 animate-pulse rounded-xl flex flex-col items-center justify-center gap-2 border border-border/40">
        <MapPin className="h-5 w-5 text-blue-600 animate-bounce" />
        <span className="text-xs text-muted-foreground font-medium">Cargando cartografía de Tres de Febrero...</span>
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
    <div className="rounded-2xl border border-border/50 bg-card text-card-foreground shadow-none p-5 flex flex-col justify-between h-full">
      {/* Header Minimalista */}
      <div className="flex items-center justify-between pb-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-foreground">Actividad territorial</h3>
        </div>
        <Link
          href="/maps"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          Ver mapa <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Map Canvas */}
      <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-border/40 my-3">
        {/* Floating Legend */}
        <div className="absolute top-2.5 right-2.5 z-20 bg-background/85 dark:bg-background/85 backdrop-blur-md border border-border/40 rounded-xl px-2.5 py-1.5 shadow-none space-y-1 text-[10px] font-medium text-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
            <span>Casos activos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
            <span>Familias registradas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Intervenciones</span>
          </div>
        </div>

        <DynamicTerritorialMap locations={locations} topArea={topArea} />
      </div>

      {/* Footer bar minimalista */}
      <Link
        href="/maps"
        className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors border border-border/30 group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate">
              {topArea}
            </span>
            <span className="text-muted-foreground/60 text-xs">·</span>
            <span className="text-[11px] text-muted-foreground truncate">
              Mayor concentración
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline-block">
            13 localidades
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </div>
  );
}
