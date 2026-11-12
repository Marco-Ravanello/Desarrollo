"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
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

/** Si el punto cambia desde afuera (por ejemplo, se encontró la dirección), el mapa va hasta ahí. */
function FollowPoint({ point, center }: { point: [number, number] | null; center: [number, number] }) {
  const map = useMap();
  const target = point ?? center;
  useEffect(() => {
    map.setView(target, point ? Math.max(map.getZoom(), 16) : 14, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target[0], target[1]]);
  return null;
}

/** Mapa para marcar a mano dónde vive una persona: se toca el lugar y aparece el pin. */
export function LocationPickerMap({
  center,
  value,
  onPick,
  className = "h-[360px]",
  follow = false,
}: {
  center: [number, number];
  value: [number, number] | null;
  onPick: (lat: number, lon: number) => void;
  /** Alto del mapa. */
  className?: string;
  /** Moverse solo hasta el punto cuando cambia. */
  follow?: boolean;
}) {
  const icon = useMemo(() => L.divIcon({ html: pinHtml, className: "", iconSize: [30, 42], iconAnchor: [15, 42] }), []);
  return (
    <MapContainer center={value || center} zoom={value || !follow ? 16 : 14} className={`${className} w-full rounded-xl z-0`} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPlace onPick={onPick} />
      {follow && <FollowPoint point={value} center={center} />}
      {value && <Marker position={value} icon={icon} />}
    </MapContainer>
  );
}
