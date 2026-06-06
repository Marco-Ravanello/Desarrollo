"use client";

import dynamic from "next/dynamic";

// Dynamic import for MapView to avoid SSR issues with Leaflet
const MapViewComponent = dynamic(
  () => import("@/components/maps/map-view").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] w-full bg-slate-100 animate-pulse flex items-center justify-center">
        <p className="text-slate-400">Cargando componentes del mapa...</p>
      </div>
    )
  }
);

export function DynamicMapView({ people }: { people: any[] }) {
  return <MapViewComponent people={people} />;
}
