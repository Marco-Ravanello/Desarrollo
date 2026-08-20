"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

interface LocationPoint {
  latitude: number;
  longitude: number;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points || points.length === 0) return;

    // @ts-ignore - leaflet.heat adds heatLayer to L
    const heat = L.heatLayer(points, {
      radius: 20,
      blur: 12,
      maxZoom: 15,
      gradient: {
        0.4: "blue",
        0.6: "cyan",
        0.7: "lime",
        0.8: "yellow",
        1.0: "red"
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

export function MiniHeatmapInner({ locations }: { locations: LocationPoint[] }) {
  const TRES_DE_FEBRERO_CENTER: [number, number] = [-34.603, -58.558];

  const heatPoints: [number, number, number][] = locations.map((loc) => [
    loc.latitude,
    loc.longitude,
    0.6
  ]);

  const center: [number, number] = heatPoints.length > 0
    ? [heatPoints[0][0], heatPoints[0][1]]
    : TRES_DE_FEBRERO_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={12}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      style={{ height: "220px", width: "100%" }}
      className="z-10 rounded-xl"
    >
      <TileLayer
        attribution=""
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <HeatmapLayer points={heatPoints} />
    </MapContainer>
  );
}
