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
import Link from "next/link";

// Dynamic import for HeatmapView to keep Leaflet logic contained
const HeatmapView = dynamic(
  () => import("./heatmap-view").then((mod) => mod.HeatmapView),
  { ssr: false }
);

// Offline Municipal Vector SVG Marker Icon
const svgMarkerHtml = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="42">
    <path fill="#2563EB" stroke="#FFFFFF" stroke-width="1.5" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
    <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
    <circle cx="12" cy="11" r="3" fill="#2563EB"/>
  </svg>
`;

const DefaultMunicipalIcon = L.divIcon({
  html: svgMarkerHtml,
  className: "custom-municipal-marker",
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -38]
});

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

  // Coordenadas del centro del Municipio de Tres de Febrero
  const TRES_DE_FEBRERO_CENTER: [number, number] = [-34.603, -58.558];

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

  const center = TRES_DE_FEBRERO_CENTER;

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
             <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Filtrar por Área / Programa</label>
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
              icon={DefaultMunicipalIcon}
            >
              <Popup className="custom-popup">
                <div className="p-1 max-w-[220px] font-sans">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-primary/10 p-1.5 rounded-full">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-bold text-sm leading-tight text-foreground">{person.firstName} {person.lastName}</h3>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{person.barrio ? `Barrio ${person.barrio}` : (person.address || 'Sin dirección')}</span>
                    </div>
                    {person.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="font-mono">{person.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2.5 pt-2 border-t flex flex-wrap gap-1">
                    {person.programasActivos && person.programasActivos.length > 0 ? (
                      person.programasActivos.slice(0, 2).map((prog: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[9px] border-primary/30 text-primary font-bold px-1.5 py-0 h-4">
                          {prog}
                        </Badge>
                      ))
                    ) : (
                      person.cases?.slice(0, 2).map((c: any) => (
                        <Badge key={c.id} variant="secondary" className="text-[9px] uppercase font-bold px-1 py-0 h-4">
                          {c.area?.name}
                        </Badge>
                      ))
                    )}
                  </div>
                  <Button asChild size="sm" className="mt-3 w-full text-[10px] font-bold h-7">
                    <Link href={`/people/${person.id}`}>
                      Ver Ficha Completa
                    </Link>
                  </Button>
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
