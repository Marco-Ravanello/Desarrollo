"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import Supercluster from "supercluster";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Phone, Layers, Flame, Download, Map as MapIcon, ExternalLink, Network, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import html2canvas from "html2canvas";
import Link from "next/link";
import { TRES_DE_FEBRERO_CENTER, TRES_DE_FEBRERO_DEFAULT_ZOOM } from "@/lib/constants/localities";
import type { MapPerson } from "@/services/map";
import { getMapPeopleAction } from "@/app/(dashboard)/maps/actions";

const HeatmapView = dynamic(
  () => import("./heatmap-view").then((mod) => mod.HeatmapView),
  { ssr: false }
);

/** Zoom máximo del mapa. Hasta acá se agrupan los puntos; lo que sigue agrupado es gente en el mismo lugar. */
const MAX_ZOOM = 18;
/** Cuántas personas se listan al tocar un grupo que ya no se puede separar. */
const GROUP_LIST_LIMIT = 50;

const svgMarkerHtml = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="36">
    <path fill="#2563EB" stroke="#FFFFFF" stroke-width="1.5" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
    <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
    <circle cx="12" cy="11" r="3" fill="#2563EB"/>
  </svg>
`;

interface MapViewProps {
  /** DNI de cada punto, en el mismo orden que `coords`. */
  dnis: string[];
  /** Coordenadas planas: [lat0, lon0, lat1, lon1, ...]. */
  coords: number[];
  loading?: boolean;
  center?: [number, number];
  zoom?: number;
  viewMode?: string;
  onViewModeChange?: (mode: string) => void;
  localityName?: string;
}

type PointProps = { i: number };
type Selection = { lat: number; lon: number; dnis: string[]; total: number };

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

function shortCount(n: number) {
  if (n < 10000) return n.toLocaleString("es-AR");
  return `${Math.round(n / 1000).toLocaleString("es-AR")} mil`;
}

const clusterIcons = new Map<string, L.DivIcon>();
function clusterIcon(count: number) {
  const label = shortCount(count);
  const cached = clusterIcons.get(label);
  if (cached) return cached;
  const size = count < 10 ? 32 : count < 100 ? 38 : count < 1000 ? 46 : count < 10000 ? 54 : 62;
  const icon = L.divIcon({
    html: `<div class="map-cluster" style="width:${size}px;height:${size}px">${label}</div>`,
    className: "map-cluster-wrapper",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  clusterIcons.set(label, icon);
  return icon;
}

function readView(map: L.Map) {
  const b = map.getBounds().pad(0.25);
  return {
    bbox: [
      Math.max(-180, b.getWest()),
      Math.max(-85, b.getSouth()),
      Math.min(180, b.getEast()),
      Math.min(85, b.getNorth()),
    ] as [number, number, number, number],
    zoom: Math.round(map.getZoom()),
  };
}

/** Dibuja solo los grupos y puntos que se ven en pantalla. */
function ClusterLayer({
  index,
  dnis,
  coords,
  icon,
  onSelect,
}: {
  index: Supercluster<PointProps>;
  dnis: string[];
  coords: number[];
  icon: L.DivIcon;
  onSelect: (s: Selection) => void;
}) {
  const map = useMap();
  const [view, setView] = useState(() => readView(map));
  useMapEvents({
    moveend: () => setView(readView(map)),
    zoomend: () => setView(readView(map)),
  });

  const items = useMemo(() => index.getClusters(view.bbox, view.zoom), [index, view]);

  return (
    <>
      {items.map((item) => {
        const [lon, lat] = item.geometry.coordinates;
        const props = item.properties as Supercluster.ClusterProperties | PointProps;
        if ("cluster" in props && props.cluster) {
          const clusterId = props.cluster_id;
          return (
            <Marker
              key={`c${clusterId}`}
              position={[lat, lon]}
              icon={clusterIcon(props.point_count)}
              title={`${props.point_count.toLocaleString("es-AR")} personas`}
              eventHandlers={{
                click: () => {
                  const next = index.getClusterExpansionZoom(clusterId);
                  if (next <= MAX_ZOOM && map.getZoom() < MAX_ZOOM) {
                    map.flyTo([lat, lon], next, { duration: 0.6 });
                    return;
                  }
                  // Ya no se separan más: es gente en la misma casa o pegada. Se listan.
                  const leaves = index.getLeaves(clusterId, GROUP_LIST_LIMIT);
                  onSelect({ lat, lon, total: props.point_count, dnis: leaves.map((l) => dnis[(l.properties as PointProps).i]) });
                },
              }}
            />
          );
        }
        const i = (props as PointProps).i;
        return (
          <Marker
            key={`p${dnis[i]}`}
            position={[coords[i * 2], coords[i * 2 + 1]]}
            icon={icon}
            eventHandlers={{ click: () => onSelect({ lat: coords[i * 2], lon: coords[i * 2 + 1], total: 1, dnis: [dnis[i]] }) }}
          />
        );
      })}
    </>
  );
}

function PersonCard({ person }: { person: MapPerson }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-2 rounded-xl text-primary font-bold shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-bold text-sm leading-tight text-foreground">{person.nombre}</h3>
          <Badge variant="outline" className="font-mono text-[10px] font-bold mt-0.5 border-border/60">
            DNI: {person.dni}
          </Badge>
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-semibold">
            {[person.direccion, person.barrio ? `Barrio ${person.barrio}` : person.localidad].filter(Boolean).join(" · ") || "Tres de Febrero"}
          </span>
        </div>
        {person.telefono && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="font-mono">{person.telefono}</span>
          </div>
        )}
      </div>

      {person.programas.length > 0 && (
        <div className="pt-1.5 border-t border-border/30 flex flex-wrap gap-1">
          {person.programas.slice(0, 3).map((prog) => (
            <Badge key={prog} variant="outline" className="text-[9px] border-primary/30 text-primary font-bold px-1.5 py-0 h-4">
              {prog}
            </Badge>
          ))}
        </div>
      )}

      <div className="pt-2 grid grid-cols-2 gap-1.5">
        <Button asChild variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-xl p-0">
          <Link href={`/people/${person.dni}`}>
            <ExternalLink className="h-3 w-3 mr-1 text-primary" />
            Expediente
          </Link>
        </Button>
        <Button asChild variant="default" size="sm" className="h-7 text-[10px] font-bold rounded-xl p-0 !text-primary-foreground">
          <Link href={`/ficha-social?dni=${person.dni}`}>
            <Network className="h-3 w-3 mr-1" />
            Ficha 360°
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Lo que aparece al tocar un punto: los datos se piden recién ahora. */
function SelectionContent({ selection }: { selection: Selection }) {
  const [people, setPeople] = useState<MapPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMapPeopleAction(selection.dnis)
      .then((res) => {
        if (!alive) return;
        if (res.success) setPeople(res.people);
        else setError(res.error);
      })
      .catch(() => alive && setError("No se pudieron cargar los datos."));
    return () => {
      alive = false;
    };
  }, [selection]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!people) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
      </p>
    );
  }
  if (people.length === 0) return <p className="text-xs text-muted-foreground">No se encontraron los datos de esta persona.</p>;
  if (people.length === 1 && selection.total === 1) return <PersonCard person={people[0]} />;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-foreground">
        {selection.total.toLocaleString("es-AR")} personas en este lugar
        {selection.total > people.length ? ` (se muestran ${people.length})` : ""}
      </p>
      <ul className="max-h-60 overflow-y-auto divide-y divide-border/40 pr-1">
        {people.map((p) => (
          <li key={p.dni} className="py-1.5">
            <Link href={`/people/${p.dni}`} className="block hover:underline">
              <span className="text-xs font-semibold text-foreground">{p.nombre}</span>
              <span className="block text-[10px] text-muted-foreground">
                DNI {p.dni}
                {p.direccion ? ` · ${p.direccion}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MapView({
  dnis,
  coords,
  loading = false,
  center = TRES_DE_FEBRERO_CENTER,
  zoom = TRES_DE_FEBRERO_DEFAULT_ZOOM,
  viewMode = "markers",
  onViewModeChange,
  localityName = "Tres de Febrero"
}: MapViewProps) {
  const [internalViewMode, setInternalViewMode] = useState<string>(viewMode);
  const [isExporting, setIsExporting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    setInternalViewMode(viewMode);
  }, [viewMode]);

  // Al cambiar los filtros se cierra lo que estaba abierto.
  useEffect(() => {
    setSelection(null);
  }, [dnis]);

  const handleModeChange = (mode: string) => {
    setInternalViewMode(mode);
    if (onViewModeChange) onViewModeChange(mode);
  };

  const index = useMemo(() => {
    const features: Supercluster.PointFeature<PointProps>[] = new Array(dnis.length);
    for (let i = 0; i < dnis.length; i++) {
      features[i] = { type: "Feature", properties: { i }, geometry: { type: "Point", coordinates: [coords[i * 2 + 1], coords[i * 2]] } };
    }
    const sc = new Supercluster<PointProps>({ radius: 80, maxZoom: MAX_ZOOM });
    sc.load(features);
    return sc;
  }, [dnis, coords]);

  const pointIcon = useMemo(() => L.divIcon({
    html: svgMarkerHtml,
    className: "custom-municipal-marker",
    iconSize: [26, 36],
    iconAnchor: [13, 36],
    popupAnchor: [0, -32]
  }), []);

  const exportMap = async () => {
    const mapElement = document.getElementById("social-map-container");
    if (!mapElement) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f8fafc",
        scale: 2,
        ignoreElements: (element) => element.classList.contains("leaflet-control-container")
      });

      const link = document.createElement("a");
      link.download = `mapa-social-3f-${localityName.toLowerCase().replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error exporting map via html2canvas:", error);
      alert("No se pudo completar la captura PNG del mapa debido a restricciones CORS de los mosaicos. Se sugiere usar la función de captura de pantalla del navegador.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative group/map" id="social-map-container">
      <style>{`
        .map-cluster-wrapper { background: transparent; border: none; }
        .map-cluster {
          display: flex; align-items: center; justify-content: center;
          border-radius: 9999px; background: rgba(37, 99, 235, 0.88); color: #fff;
          font: 700 12px/1 system-ui, sans-serif; border: 3px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25), 0 2px 6px rgba(0, 0, 0, 0.25);
          cursor: pointer;
        }
      `}</style>

      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-[1000] flex flex-col gap-2 pointer-events-none max-w-[calc(100%-2rem)]">
        <div className="bg-background/90 backdrop-blur-md p-2.5 rounded-2xl shadow-2xl border border-border/60 pointer-events-auto flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapIcon className="h-4 w-4" />}
          </div>
          <div className="pr-4 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none truncate">
              {localityName}
            </p>
            <p className="text-xs font-bold text-foreground mt-0.5">
              {dnis.length.toLocaleString("es-AR")} {dnis.length === 1 ? "persona" : "personas"} en el mapa
            </p>
            {internalViewMode === "markers" && dnis.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">Tocá un círculo para acercarte</p>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 sm:bottom-auto sm:top-6 sm:right-6 z-[1000] flex flex-col gap-3">
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
          className="hidden sm:flex rounded-2xl bg-background/90 backdrop-blur-md border border-border/60 text-foreground hover:bg-accent shadow-2xl h-11 gap-2 text-xs font-bold"
        >
          <Download className="h-4 w-4 text-primary" />
          {isExporting ? "Exportando Mapa..." : "Capturar Vista PNG"}
        </Button>
      </div>

      {internalViewMode === "markers" ? (
        <MapContainer
          center={center}
          zoom={zoom}
          maxZoom={MAX_ZOOM}
          zoomControl={false}
          style={{ height: "620px", width: "100%", borderRadius: "1.5rem" }}
          scrollWheelZoom={true}
          className="z-0 overflow-hidden"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            crossOrigin="anonymous"
            maxZoom={MAX_ZOOM}
          />

          <ZoomControl position="bottomleft" />

          <ClusterLayer index={index} dnis={dnis} coords={coords} icon={pointIcon} onSelect={setSelection} />

          {selection && (
            <Popup
              key={`${selection.lat},${selection.lon},${selection.dnis[0]}`}
              position={[selection.lat, selection.lon]}
              className="custom-popup"
              eventHandlers={{ remove: () => setSelection(null) }}
            >
              <div className="p-1 w-[240px] font-sans">
                <SelectionContent selection={selection} />
              </div>
            </Popup>
          )}

          <ChangeView center={center} zoom={zoom} />
        </MapContainer>
      ) : (
        <HeatmapView coords={coords} center={center} zoom={zoom} />
      )}
    </div>
  );
}
