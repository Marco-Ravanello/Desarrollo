"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

interface HeatmapViewProps {
  people: any[];
  filterArea: string;
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
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

export function HeatmapView({ people, filterArea }: HeatmapViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[600px] w-full bg-muted animate-pulse flex items-center justify-center">
        <p className="text-muted-foreground">Cargando mapa de calor...</p>
      </div>
    );
  }

  // Filtrar personas con coordenadas y por área
  const filteredPeople = people.filter((p) => {
    if (!p.latitude || !p.longitude) return false;
    if (filterArea === "all") return true;
    return p.cases?.some((c: any) => c.areaId === filterArea);
  });

  // Convertir a formato de puntos de calor [lat, lng, intensidad]
  const heatPoints: [number, number, number][] = filteredPeople.map(p => [
    p.latitude,
    p.longitude,
    0.5 // Intensidad base
  ]);

  const center: [number, number] = heatPoints.length > 0
    ? [heatPoints[0][0], heatPoints[0][1]]
    : [-34.6037, -58.3816];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "600px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <HeatLayer points={heatPoints} />
    </MapContainer>
  );
}
