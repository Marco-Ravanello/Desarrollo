"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Phone } from "lucide-react";

// Fix Leaflet default icon issue in Next.js
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  people: any[];
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center);
  return null;
}

export function MapView({ people }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [filterArea, setFilterArea] = useState<string>("all");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[600px] w-full bg-slate-100 animate-pulse flex items-center justify-center">
        <p className="text-slate-400">Cargando mapa...</p>
      </div>
    );
  }

  // Filtrar personas que tienen coordenadas y opcionalmente por área de su último caso
  const filteredPeople = people.filter((p) => {
    if (!p.latitude || !p.longitude) return false;
    if (filterArea === "all") return true;

    // Verificamos si alguno de sus casos pertenece al área filtrada
    return p.cases?.some((c: any) => c.areaId === filterArea);
  });

  // Centro por defecto (puede ser el de la ciudad específica si se conoce)
  const defaultCenter: [number, number] = [-34.6037, -58.3816]; // Buenos Aires como fallback
  const center = filteredPeople.length > 0
    ? [filteredPeople[0].latitude, filteredPeople[0].longitude] as [number, number]
    : defaultCenter;

  // Extraer áreas únicas para el filtro de los casos de las personas
  const areas = Array.from(new Set(
    people.flatMap(p => p.cases?.map((c: any) => ({ id: c.areaId, name: c.area?.name })) || [])
      .filter((a: any) => a && a.id)
      .map(a => JSON.stringify(a))
  )).map(s => JSON.parse(s as string));

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow-md border border-slate-200">
        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Filtrar por Área</label>
        <select
          className="text-sm border-none focus:ring-0 cursor-pointer bg-transparent"
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
        >
          <option value="all">Todas las áreas</option>
          {areas.map((area: any) => (
            <option key={area.id} value={area.id}>{area.name}</option>
          ))}
        </select>
      </div>

      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "600px", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {filteredPeople.map((person) => (
          <Marker
            key={person.id}
            position={[person.latitude, person.longitude]}
          >
            <Popup className="custom-popup">
              <div className="p-1 max-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-blue-100 p-1.5 rounded-full">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-sm leading-tight">{person.firstName} {person.lastName}</h3>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {person.address || 'Sin dirección'}
                  </div>
                  {person.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {person.phone}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-2 border-t flex flex-wrap gap-1">
                  {person.cases?.slice(0, 2).map((c: any) => (
                    <Badge key={c.id} variant="secondary" className="text-[10px]">
                      {c.area?.name}
                    </Badge>
                  ))}
                </div>
                <a
                  href={`/people/${person.id}`}
                  className="mt-3 block text-center bg-slate-900 text-white text-[10px] py-1.5 rounded hover:bg-slate-800 transition-colors"
                >
                  Ver Ficha Completa
                </a>
              </div>
            </Popup>
          </Marker>
        ))}

        <ChangeView center={center} />
      </MapContainer>
    </div>
  );
}
