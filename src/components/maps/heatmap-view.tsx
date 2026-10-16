"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { TRES_DE_FEBRERO_CENTER, TRES_DE_FEBRERO_DEFAULT_ZOOM } from "@/lib/constants/localities";

interface HeatmapViewProps {
  /** Coordenadas planas: [lat0, lon0, lat1, lon1, ...]. */
  coords: number[];
  center?: [number, number];
  zoom?: number;
}

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    // @ts-ignore - leaflet.heat adds heatLayer to L
    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.4: "blue",
        0.6: "cyan",
        0.7: "lime",
        0.8: "yellow",
        1.0: "red"
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export function HeatmapView({
  coords,
  center = TRES_DE_FEBRERO_CENTER,
  zoom = TRES_DE_FEBRERO_DEFAULT_ZOOM
}: HeatmapViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  const heatPoints = useMemo(() => {
    const points: [number, number, number][] = new Array(coords.length / 2);
    for (let i = 0; i < points.length; i++) points[i] = [coords[i * 2], coords[i * 2 + 1], 0.6];
    return points;
  }, [coords]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[620px] w-full rounded-2xl bg-muted/40 animate-pulse flex items-center justify-center">
        <p className="text-muted-foreground text-xs font-bold">Cargando mapa de calor socio-barrial...</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      style={{ height: "620px", width: "100%", borderRadius: "1.5rem" }}
      className="z-0 overflow-hidden"
    >
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <HeatLayer points={heatPoints} />
      <ChangeView center={center} zoom={zoom} />
    </MapContainer>
  );
}
