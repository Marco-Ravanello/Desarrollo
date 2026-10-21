"use client";

import { MapPlaceholder } from "@/components/layout/page-skeletons";
import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Compass, MapPin, ChevronRight, ArrowUpRight } from "lucide-react";

const DynamicTerritorialMap = dynamic(
  () => import("./territorial-map-inner").then((mod) => mod.TerritorialMapInner),
  {
    ssr: false,
    loading: () => <MapPlaceholder height={220} className="rounded-xl" />
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
  topArea?: string | null;
  locations?: LocationPoint[];
}

export function TerritorialActivityWidget({
  topArea,
  locations = []
}: TerritorialActivityWidgetProps) {
  const hasTopArea = Boolean(topArea && topArea !== "Sin datos");
  return (
    <div className="rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm p-5 flex flex-col justify-between h-full">
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
        {locations.length > 0 ? (
          <div className="absolute top-2.5 right-2.5 z-20 bg-background/85 backdrop-blur-md border border-border/40 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
            <span>Personas con domicilio ubicado</span>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[1px] p-6 text-center">
            <p className="text-xs text-muted-foreground">Todavía no hay personas con domicilio ubicado en el mapa.</p>
          </div>
        )}

        <DynamicTerritorialMap locations={locations} />
      </div>

      {/* Pie: zona con más personas registradas */}
      <Link
        href="/maps"
        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-border/40 group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          {hasTopArea ? (
            <p className="text-xs text-muted-foreground truncate">
              Mayor concentración: <span className="font-semibold text-foreground">{topArea}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">Ver el mapa social completo</p>
          )}
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </Link>
    </div>
  );
}
