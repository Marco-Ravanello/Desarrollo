"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Phone, Layers, Flame, Download, Filter, Map as MapIcon, ExternalLink, Network } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import domtoimage from "dom-to-image";
import Link from "next/link";
import { TRES_DE_FEBRERO_CENTER, TRES_DE_FEBRERO_DEFAULT_ZOOM } from "@/lib/constants/localities";

const HeatmapView = dynamic(
  () => import("./heatmap-view").then((mod) => mod.HeatmapView),
  { ssr: false }
);

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
  center?: [number, number];
  zoom?: number;
  viewMode?: string;
  onViewModeChange?: (mode: string) => void;
  localityName?: string;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export function MapView({
  people,
  center = TRES_DE_FEBRERO_CENTER,
  zoom = TRES_DE_FEBRERO_DEFAULT_ZOOM,
  viewMode = "markers",
  onViewModeChange,
  localityName = "Tres de Febrero"
}: MapViewProps) {
  const [filterArea, setFilterArea] = useState<string>("all");
  const [internalViewMode, setInternalViewMode] = useState<string>(viewMode);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setInternalViewMode(viewMode);
  }, [viewMode]);

  const handleModeChange = (mode: string) => {
    setInternalViewMode(mode);
    if (onViewModeChange) onViewModeChange(mode);
  };

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
      link.download = `mapa-social-3f-${localityName.toLowerCase().replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error exporting map:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredPeople = people.filter((p) => {
    if (!p.latitude || !p.longitude) return false;
    if (filterArea === "all") return true;
    return p.cases?.some((c: any) => c.areaId === filterArea);
  });

  const areas = Array.from(
    new Set(
      people
        .flatMap((p) => p.cases?.map((c: any) => ({ id: c.areaId, name: c.area?.name })) || [])
        .filter((a: any) => a && a.id)
        .map((a) => JSON.stringify(a))
    )
  ).map((s) => JSON.parse(s as string));

  return (
    <div className="relative group/map" id="social-map-container">
      <div className="absolute top-6 left-6 z-[1000] flex items-center gap-2 pointer-events-none">
        <div className="bg-background/90 backdrop-blur-md p-2.5 rounded-2xl shadow-2xl border border-border/60 pointer-events-auto flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl">
            <MapIcon className="h-4 w-4" />
          </div>
          <div className="pr-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">
              {localityName}
            </p>
            <p className="text-xs font-bold text-foreground mt-0.5">
              {internalViewMode === "markers" ? "Puntos de Atención Georreferenciados" : "Mapa de Calor Socio-Barrial"}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
        <div className="bg-background/90 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border border-border/60 min-w-[240px]">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              Filtrar por Área / Programa
            </label>
          </div>
          <select
            className="text-xs border-none focus:ring-0 cursor-pointer bg-muted/50 rounded-xl px-3 py-2 w-full font-bold text-foreground hover:bg-muted transition-colors"
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
          >
            <option value="all">Todas las Áreas Sociales</option>
            {areas.map((area: any) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <Tabs value={internalViewMode} onValueChange={handleModeChange} className="w-full">
          <TabsList className="grid grid-cols-2 bg-background/90 backdrop-blur-md shadow-2xl border border-border/60 p-1.5 rounded-2xl">
            <TabsTrigger
              value="markers"
              className="rounded-xl text-xs gap-2 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              <Layers className="h-3.5 w-3.5" /> Puntos
            </TabsTrigger>
            <TabsTrigger
              value="heatmap"
              className="rounded-xl text-xs gap-2 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              <Flame className="h-3.5 w-3.5" /> Calor
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={exportMap}
          disabled={isExporting}
          className="rounded-2xl bg-background/90 backdrop-blur-md border border-border/60 text-foreground hover:bg-accent shadow-2xl h-11 gap-2 text-xs font-bold"
        >
          <Download className="h-4 w-4 text-primary" />
          {isExporting ? "Exportando Mapa..." : "Capturar Vista PNG"}
        </Button>
      </div>

      {internalViewMode === "markers" ? (
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "620px", width: "100%", borderRadius: "1.5rem" }}
          scrollWheelZoom={true}
          className="z-0 overflow-hidden"
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
                <div className="p-1 max-w-[240px] font-sans space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-2 rounded-xl text-primary font-bold shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-tight text-foreground">
                        {person.lastName}, {person.firstName}
                      </h3>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold mt-0.5 border-border/60">
                        DNI: {person.dni}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/30">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate font-semibold">
                        {person.barrio ? `Barrio ${person.barrio}` : person.address || "Tres de Febrero"}
                      </span>
                    </div>
                    {person.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="font-mono">{person.phone}</span>
                      </div>
                    )}
                  </div>

                  {((person.programasActivos && person.programasActivos.length > 0) ||
                    (person.cases && person.cases.length > 0)) && (
                    <div className="pt-1.5 border-t border-border/30 flex flex-wrap gap-1">
                      {person.programasActivos && person.programasActivos.length > 0 ? (
                        person.programasActivos.slice(0, 2).map((prog: string, idx: number) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-[9px] border-primary/30 text-primary font-bold px-1.5 py-0 h-4"
                          >
                            {prog}
                          </Badge>
                        ))
                      ) : (
                        person.cases?.slice(0, 2).map((c: any) => (
                          <Badge
                            key={c.id}
                            variant="secondary"
                            className="text-[9px] uppercase font-bold px-1.5 py-0 h-4"
                          >
                            {c.area?.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  )}

                  <div className="pt-2 grid grid-cols-2 gap-1.5">
                    <Button asChild variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-xl p-0">
                      <Link href={`/people/${person.id}`}>
                        <ExternalLink className="h-3 w-3 mr-1 text-primary" />
                        Expediente
                      </Link>
                    </Button>

                    <Button asChild variant="default" size="sm" className="h-7 text-[10px] font-bold rounded-xl p-0">
                      <Link href={`/ficha-social?dni=${person.dni}`}>
                        <Network className="h-3 w-3 mr-1" />
                        Ficha 360°
                      </Link>
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          <ChangeView center={center} zoom={zoom} />
        </MapContainer>
      ) : (
        <HeatmapView people={people} filterArea={filterArea} center={center} zoom={zoom} />
      )}
    </div>
  );
}
