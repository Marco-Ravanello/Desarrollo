"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Phone, Layers, Flame, Download, Filter, Map as MapIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import domtoimage from "dom-to-image";

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
  const [isExporting, setIsExporting] = useState(false);

  const exportMap = async () => {
    const mapElement = document.getElementById("social-map-container");
    if (!mapElement) return;

    setIsExporting(true);
    try {
      const dataUrl = await domtoimage.toPng(mapElement, {
        quality: 0.95,
        bgcolor: "#f8fafc",
      });
      const link = document.createElement("a");
      link.download = `mapa-social-${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error exporting map:", error);
    } finally {
      setIsExporting(false);
    }
  };

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
    <div className="relative group/map" id="social-map-container">
      {/* Controles del Mapa */}
      <div className="absolute top-6 left-6 z-[1000] flex items-center gap-2 pointer-events-none">
        <div className="bg-background/80 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-border/50 pointer-events-auto flex items-center gap-2">
          <div className="bg-primary text-white p-2 rounded-xl">
             <MapIcon className="h-4 w-4" />
          </div>
          <div className="pr-4">
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Capa Activa</p>
             <p className="text-xs font-bold">{viewMode === 'markers' ? 'Puntos de Atención' : 'Mapa de Calor'}</p>
          </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
        <div className="bg-background/80 backdrop-blur-md p-4 rounded-[2rem] shadow-2xl border border-border/50 min-w-[240px]">
          <div className="flex items-center gap-2 mb-3">
             <Filter className="h-3 w-3 text-primary" />
             <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Filtrar por Área</label>
          </div>
          <select
            className="text-sm border-none focus:ring-0 cursor-pointer bg-muted/50 rounded-xl px-3 py-2 w-full font-bold appearance-none transition-colors hover:bg-muted"
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
          >
            <option value="all">Todo el Territorio</option>
            {areas.map((area: any) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <TabsList className="grid grid-cols-2 bg-background/80 backdrop-blur-md shadow-2xl border border-border/50 p-1.5 rounded-[2rem]">
            <TabsTrigger value="markers" className="rounded-full text-xs gap-2 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Layers className="h-3.5 w-3.5" /> Puntos
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="rounded-full text-xs gap-2 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Flame className="h-3.5 w-3.5" /> Calor
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={exportMap}
          disabled={isExporting}
          className="rounded-full bg-background/80 backdrop-blur-md border border-border/50 text-foreground hover:bg-accent shadow-2xl h-12 gap-2 font-bold"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exportando...' : 'Exportar Vista'}
        </Button>
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
