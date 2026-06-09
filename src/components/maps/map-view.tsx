"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Phone, Layers, Flame } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";

// Dynamic import for HeatmapView to keep Leaflet logic contained
const HeatmapView = dynamic(
  () => import("./heatmap-view").then((mod) => mod.HeatmapView),
  { ssr: false }
);

// Fix Leaflet default icon issue
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
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export function MapView({ people }: MapViewProps) {
  const [filterArea, setFilterArea] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("markers");

  // Filtrar personas que tienen coordenadas y opcionalmente por área
  const filteredPeople = people.filter((p) => {
    if (!p.latitude || !p.longitude) return false;
    if (filterArea === "all") return true;
    return p.cases?.some((c: any) => c.areaId === filterArea);
  });

  const defaultCenter: [number, number] = [-34.6037, -58.3816];
  const center = filteredPeople.length > 0
    ? [filteredPeople[0].latitude, filteredPeople[0].longitude] as [number, number]
    : defaultCenter;

  const areas = Array.from(new Set(
    people.flatMap(p => p.cases?.map((c: any) => ({ id: c.areaId, name: c.area?.name })) || [])
      .filter((a: any) => a && a.id)
      .map(a => JSON.stringify(a))
  )).map(s => JSON.parse(s as string));

  return (
    <div className="relative group/map">
      {/* Controles del Mapa */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="bg-background/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-border min-w-[200px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-2 tracking-widest">Filtrar por Área</label>
          <select
            className="text-sm border-none focus:ring-0 cursor-pointer bg-transparent w-full font-medium"
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
          >
            <option value="all">Todas las áreas</option>
            {areas.map((area: any) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <TabsList className="grid grid-cols-2 bg-background/95 backdrop-blur-sm shadow-xl border border-border p-1 rounded-xl">
            <TabsTrigger value="markers" className="text-xs gap-2">
              <Layers className="h-3.5 w-3.5" /> Marcadores
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="text-xs gap-2">
              <Flame className="h-3.5 w-3.5" /> Calor
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "markers" ? (
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "600px", width: "100%" }}
          scrollWheelZoom={true}
          className="z-0"
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
                <div className="p-1 max-w-[200px] font-sans">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-primary/10 p-1.5 rounded-full">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-bold text-sm leading-tight text-foreground">{person.firstName} {person.lastName}</h3>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
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
                      <Badge key={c.id} variant="secondary" className="text-[9px] uppercase font-bold px-1 py-0 h-4">
                        {c.area?.name}
                      </Badge>
                    ))}
                  </div>
                  <a
                    href={`/people/${person.id}`}
                    className="mt-3 block text-center bg-primary text-primary-foreground text-[10px] font-bold py-1.5 rounded-lg hover:brightness-110 transition-all"
                  >
                    Ver Ficha Completa
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}

          <ChangeView center={center} />
        </MapContainer>
      ) : (
        <HeatmapView people={people} filterArea={filterArea} />
      )}
    </div>
  );
}
