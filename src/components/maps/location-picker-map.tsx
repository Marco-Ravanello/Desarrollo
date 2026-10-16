"use client";

import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinHtml = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="42">
    <path fill="#E8590C" stroke="#FFFFFF" stroke-width="1.5" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
    <circle cx="12" cy="11" r="4" fill="#FFFFFF"/>
  </svg>
`;

function ClickToPlace({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Mapa para marcar a mano dónde vive una persona: se toca el lugar y aparece el pin. */
export function LocationPickerMap({
  center,
  value,
  onPick,
}: {
  center: [number, number];
  value: [number, number] | null;
  onPick: (lat: number, lon: number) => void;
}) {
  const icon = useMemo(() => L.divIcon({ html: pinHtml, className: "", iconSize: [30, 42], iconAnchor: [15, 42] }), []);
  return (
    <MapContainer center={value || center} zoom={16} className="h-[360px] w-full rounded-xl z-0" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPlace onPick={onPick} />
      {value && <Marker position={value} icon={icon} />}
    </MapContainer>
  );
}
