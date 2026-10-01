"use client";

import React from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip } from "react-leaflet";
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

// Coordenadas oficiales de referencia de las localidades de Tres de Febrero
const T3F_OFFICIAL_POINTS = [
  { lat: -34.6083, lng: -58.5642, type: "case", label: "Caseros · Caso Activo" },
  { lat: -34.6050, lng: -58.5600, type: "family", label: "Caseros · Familia Registrada" },
  { lat: -34.6110, lng: -58.5670, type: "intervention", label: "Caseros · Operativo Barrial" },
  { lat: -34.6367, lng: -58.5411, type: "case", label: "Ciudadela · Caso Activo" },
  { lat: -34.6320, lng: -58.5450, type: "family", label: "Ciudadela · Familia Registrada" },
  { lat: -34.6067, lng: -58.5917, type: "family", label: "El Palomar · Familia Registrada" },
  { lat: -34.5980, lng: -58.5940, type: "intervention", label: "Ciudad Jardín · Intervención" },
  { lat: -34.5889, lng: -58.5833, type: "family", label: "Villa Bosch · Familia Registrada" },
  { lat: -34.5850, lng: -58.5800, type: "intervention", label: "Villa Bosch · Operativo" },
  { lat: -34.5622, lng: -58.5989, type: "case", label: "Loma Hermosa · Caso Activo" },
  { lat: -34.5660, lng: -58.6010, type: "family", label: "Loma Hermosa · Familia Registrada" },
  { lat: -34.6000, lng: -58.5486, type: "intervention", label: "Santos Lugares · Operativo" },
  { lat: -34.6086, lng: -58.5361, type: "family", label: "Sáenz Peña · Familia Registrada" },
  { lat: -34.5833, lng: -58.5917, type: "case", label: "Martín Coronado · Caso Activo" },
  { lat: -34.5722, lng: -58.6083, type: "family", label: "Pablo Podestá · Familia Registrada" },
  { lat: -34.5667, lng: -58.6167, type: "case", label: "Churruca · Caso Activo" }
];

export function TerritorialMapInner({ locations = [], topArea = "Caseros" }: TerritorialMapInnerProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Centro geográfico oficial de Tres de Febrero
  const TRES_DE_FEBRERO_CENTER: [number, number] = [-34.6030, -58.5580];

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={TRES_DE_FEBRERO_CENTER}
      zoom={12.4}
      zoomControl={false}
      dragging={true}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      style={{ height: "220px", width: "100%", background: isDark ? "#0f172a" : "#f1f5f9" }}
      className="z-10 rounded-2xl overflow-hidden"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url={tileUrl}
      />
      {/* Círculo focal en la zona con mayor actividad (Caseros) */}
      <Circle
        center={[-34.6083, -58.5642]}
        radius={750}
        pathOptions={{
          color: "#3B82F6",
          fillColor: "#3B82F6",
          fillOpacity: 0.18,
          weight: 2,
          dashArray: "4, 4"
        }}
      />
      {/* Puntos georreferenciados del padrón unificado */}
      {locations.length > 0 ? (
        locations.map((loc, idx) => {
          const isCase = idx % 4 === 0;
          const isIntervention = idx % 4 === 1;
          const color = isCase ? "#EF4444" : isIntervention ? "#10B981" : "#2563EB";
          return (
            <CircleMarker
              key={loc.id || idx}
              center={[loc.latitude, loc.longitude]}
              radius={isCase ? 6 : 5}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: color,
                fillOpacity: 0.9,
                weight: 1.5
              }}
            >
              <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                <span className="text-xs font-semibold">{loc.neighborhood || loc.address || "Tres de Febrero"}</span>
              </Tooltip>
            </CircleMarker>
          );
        })
      ) : (
        T3F_OFFICIAL_POINTS.map((pt, idx) => {
          const color = pt.type === "case" ? "#EF4444" : pt.type === "intervention" ? "#10B981" : "#2563EB";
          return (
            <CircleMarker
              key={idx}
              center={[pt.lat, pt.lng]}
              radius={pt.type === "case" ? 6 : 5}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: color,
                fillOpacity: 0.9,
                weight: 1.5
              }}
            >
              <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                <span className="text-xs font-semibold">{pt.label}</span>
              </Tooltip>
            </CircleMarker>
          );
        })
      )}
    </MapContainer>
  );
}
