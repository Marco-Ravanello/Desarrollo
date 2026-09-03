"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import for MapView to avoid SSR issues with Leaflet
const MapViewComponent = dynamic(
  () => import("@/components/maps/map-view").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] w-full bg-muted/40 animate-pulse flex flex-col items-center justify-center gap-2 rounded-[2.5rem]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm font-bold text-muted-foreground">Cargando componentes del mapa...</p>
      </div>
    )
  }
);

export function DynamicMapView({ people }: { people: any[] }) {
  return <MapViewComponent people={people} />;
}
