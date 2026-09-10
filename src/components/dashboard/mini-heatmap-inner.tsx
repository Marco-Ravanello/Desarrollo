"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
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
      radius: 22,
      blur: 14,
      maxZoom: 15,
      gradient: {
        0.2: "#0055ff",
        0.4: "#00f0ff",
        0.6: "#00ff66",
        0.8: "#ffea00",
        1.0: "#ff0055"
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

export function MiniHeatmapInner({ locations }: { locations: LocationPoint[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const TRES_DE_FEBRERO_CENTER: [number, number] = [-34.603, -58.558];

  const heatPoints: [number, number, number][] = (locations || []).map((loc) => [
    loc.latitude,
    loc.longitude,
    0.7
  ]);

  const center: [number, number] = heatPoints.length > 0
    ? [heatPoints[0][0], heatPoints[0][1]]
    : TRES_DE_FEBRERO_CENTER;

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={center}
      zoom={12}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      style={{ height: "220px", width: "100%" }}
      className="z-10 rounded-xl overflow-hidden"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url={tileUrl}
      />
      <HeatmapLayer points={heatPoints} />
    </MapContainer>
  );
}
