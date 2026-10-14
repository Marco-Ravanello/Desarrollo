"use client";

import React from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { useTheme } from "next-themes";
import "leaflet/dist/leaflet.css";

interface LocationPoint {
  id?: string;
  latitude: number;
  longitude: number;
  neighborhood?: string;
  address?: string;
}

interface TerritorialMapInnerProps {
  locations?: LocationPoint[];
  topArea?: string;
}


export function TerritorialMapInner({ locations = [] }: TerritorialMapInnerProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const TRES_DE_FEBRERO_CENTER: [number, number] = [-34.6030, -58.5580];

  // Mismo proveedor que el Mapa Social: CARTO ahora exige clave y muestra una marca de agua.
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <MapContainer
      center={TRES_DE_FEBRERO_CENTER}
      zoom={12.4}
      zoomControl={false}
      dragging={true}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      style={{ height: "220px", width: "100%", background: isDark ? "#0f172a" : "#f1f5f9" }}
      className="z-10 rounded-xl overflow-hidden"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={tileUrl}
      />
      {/* Solo personas reales con ubicación cargada; sin puntos de ejemplo. */}
      {locations.map((loc, idx) => (
        <CircleMarker
          key={loc.id || idx}
          center={[loc.latitude, loc.longitude]}
          radius={4.5}
          pathOptions={{
            color: "#FFFFFF",
            fillColor: "#2563EB",
            fillOpacity: 0.9,
            weight: 1.5
          }}
        >
          <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
            <span className="text-xs font-semibold">{loc.neighborhood || loc.address || "Tres de Febrero"}</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
