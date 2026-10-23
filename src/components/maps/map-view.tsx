"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import Supercluster from "supercluster";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Phone, Layers, Flame, Download, Map as MapIcon, ExternalLink, Network, Loader2, FolderOpen, CloudRain, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import html2canvas from "html2canvas";
import Link from "next/link";
import { TRES_DE_FEBRERO_CENTER, TRES_DE_FEBRERO_DEFAULT_ZOOM } from "@/lib/constants/localities";
import type { MapPerson } from "@/services/map";
import type { MapCaseItem, MapLayerPoints, MapStormItem } from "@/services/map-layers";
import { getMapLayerItemsAction, getMapPeopleAction } from "@/app/(dashboard)/maps/actions";
import { APPROX_COLOR, CASE_COLOR, EXACT_COLOR, PROGRAM_COLORS, STORM_COLOR } from "@/lib/map-colors";
import { formatFecha } from "@/lib/fechas";
import { barrioLabel } from "@/lib/person-display";

const HeatmapView = dynamic(
  () => import("./heatmap-view").then((mod) => mod.HeatmapView),
  { ssr: false }
);

/** Zoom máximo del mapa. Hasta acá se agrupan los puntos; lo que sigue agrupado es gente en el mismo lugar. */
const MAX_ZOOM = 18;
/** Cuántas personas se listan al tocar un grupo que ya no se puede separar. */
const GROUP_LIST_LIMIT = 50;

const svgMarkerHtml = (color: string) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="36">
    <path fill="${color}" stroke="#FFFFFF" stroke-width="1.5" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
    <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
    <circle cx="12" cy="11" r="3" fill="${color}"/>
  </svg>
`;

/** Expedientes: un cuadrado con una carpeta. */
const caseMarkerHtml = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26" width="26" height="26">
    <rect x="1.5" y="1.5" width="23" height="23" rx="6" fill="${CASE_COLOR}" stroke="#FFFFFF" stroke-width="2"/>
    <path fill="#FFFFFF" d="M7 9.5c0-.8.6-1.5 1.4-1.5h3l1.4 1.6h4.8c.8 0 1.4.7 1.4 1.5v5.4c0 .8-.6 1.5-1.4 1.5H8.4c-.8 0-1.4-.7-1.4-1.5z"/>
  </svg>
`;

/** Fichas de emergencia: un triángulo con una gota. */
const stormMarkerHtml = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 26" width="28" height="26">
    <path d="M14 1.8 26.6 23.6H1.4z" fill="${STORM_COLOR}" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
    <path fill="#FFFFFF" d="M14 9.5c1.9 2.6 3 4.3 3 5.6a3 3 0 0 1-6 0c0-1.3 1.1-3 3-5.6z"/>
  </svg>
`;

type Variant = "exact" | "approx" | "program" | "cases" | "storm";
export type MapLayerKind = "padron" | "cases" | "storm";

/** Qué capas se ven. El padrón se puede apagar para mirar solo expedientes o fichas. */
export interface MapLayerToggles {
  padron: boolean;
  cases: boolean;
  storm: boolean;
}

interface LayerData {
  points: MapLayerPoints | null;
  loading: boolean;
}

interface MapViewProps {
  /** DNI de cada punto, en el mismo orden que `coords`. */
  dnis: string[];
  /** Los primeros `exactCount` puntos son exactos; el resto, aproximados (solo barrio). */
  exactCount: number;
  /** Coordenadas planas: [lat0, lon0, lat1, lon1, ...]. */
  coords: number[];
  loading?: boolean;
  center?: [number, number];
  zoom?: number;
  viewMode?: string;
  onViewModeChange?: (mode: string) => void;
  localityName?: string;
  /** Programas elegidos para comparar (cada uno con su color) y a cuáles pertenece cada punto. */
  programs?: string[];
  programMask?: number[];
  toggles?: MapLayerToggles;
  onTogglesChange?: (toggles: MapLayerToggles) => void;
  caseLayer?: LayerData;
  stormLayer?: LayerData;
}

type PointProps = { i: number };
type Selection = { kind: MapLayerKind; lat: number; lon: number; ids: string[]; total: number };

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
function clusterIcon(count: number, variant: Variant, color?: string) {
  const label = shortCount(count);
  const key = `${variant}:${color ?? ""}:${label}`;
  const cached = clusterIcons.get(key);
  if (cached) return cached;
  const size = count < 10 ? 32 : count < 100 ? 38 : count < 1000 ? 46 : count < 10000 ? 54 : 62;
  const style = color ? `width:${size}px;height:${size}px;--cluster:${color}` : `width:${size}px;height:${size}px`;
  const icon = L.divIcon({
    html: `<div class="map-cluster map-cluster-${variant}" style="${style}"><span>${label}</span></div>`,
    className: "map-cluster-wrapper",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  clusterIcons.set(key, icon);
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
const CLUSTER_NOUN: Record<Variant, [string, string]> = {
  exact: ["persona", "personas"],
  approx: ["persona con ubicación aproximada (solo barrio)", "personas con ubicación aproximada (solo barrio)"],
  program: ["persona", "personas"],
  cases: ["expediente abierto", "expedientes abiertos"],
  storm: ["ficha de emergencia", "fichas de emergencia"],
};

function ClusterLayer({
  index,
  ids,
  coords,
  icon,
  variant,
  kind,
  color,
  label,
  zIndexOffset = 0,
  onSelect,
}: {
  index: Supercluster<PointProps>;
  ids: string[];
  coords: number[];
  icon: L.DivIcon;
  variant: Variant;
  kind: MapLayerKind;
  /** Color del grupo, para los programas. */
  color?: string;
  /** A qué capa o programa pertenece, para el texto al pasar el mouse. */
  label?: string;
  zIndexOffset?: number;
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
              icon={clusterIcon(props.point_count, variant, color)}
              zIndexOffset={zIndexOffset}
              title={`${props.point_count.toLocaleString("es-AR")} ${CLUSTER_NOUN[variant][props.point_count === 1 ? 0 : 1]}${label ? ` · ${label}` : ""}`}
              eventHandlers={{
                click: () => {
                  const next = index.getClusterExpansionZoom(clusterId);
                  if (next <= MAX_ZOOM && map.getZoom() < MAX_ZOOM) {
                    map.flyTo([lat, lon], next, { duration: 0.6 });
                    return;
                  }
                  // Ya no se separan más: es gente en la misma casa o pegada. Se listan.
                  const leaves = index.getLeaves(clusterId, GROUP_LIST_LIMIT);
                  onSelect({ kind, lat, lon, total: props.point_count, ids: leaves.map((l) => ids[(l.properties as PointProps).i]) });
                },
              }}
            />
          );
        }
        const i = (props as PointProps).i;
        return (
          <Marker
            key={`p${ids[i]}`}
            position={[coords[i * 2], coords[i * 2 + 1]]}
            icon={icon}
            zIndexOffset={zIndexOffset}
            title={label}
            eventHandlers={{ click: () => onSelect({ kind, lat: coords[i * 2], lon: coords[i * 2 + 1], total: 1, ids: [ids[i]] }) }}
          />
        );
      })}
    </>
  );
}

/** Dirección y barrio, sin repetir el barrio si la dirección ya lo nombra. */
function addressLine(person: MapPerson): string {
  const direccion = person.direccion?.trim() || "";
  const barrio = person.barrio?.trim() || "";
  const place = barrio && !direccion.toLowerCase().includes(barrio.toLowerCase()) ? barrioLabel(barrio) : barrio ? "" : person.localidad;
  return [direccion, place].filter(Boolean).join(" · ") || "Tres de Febrero";
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
          <Badge variant="outline" className="font-mono text-xs font-bold mt-0.5 border-border/60">
            DNI: {person.dni}
          </Badge>
        </div>
      </div>

      {person.aproximada && (
        <p className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Ubicación aproximada: la dirección cargada solo tiene el barrio.
        </p>
      )}

      <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-semibold">
            {addressLine(person)}
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
            <Badge key={prog} variant="outline" className="text-xs border-primary/30 text-primary font-bold px-1.5 py-0 h-4">
              {prog}
            </Badge>
          ))}
        </div>
      )}

      <div className="pt-2">
        <Button asChild variant="default" size="sm" className="h-7 w-full text-xs font-bold rounded-xl !text-primary-foreground">
          <Link href={`/people/${person.dni}`}>
            <Network className="h-3 w-3 mr-1" />
            Ver ficha
          </Link>
        </Button>
      </div>
    </div>
  );
}

const shortDate = formatFecha;

function CaseCard({ item }: { item: MapCaseItem }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="rounded-xl p-2 shrink-0 text-white" style={{ background: CASE_COLOR }}>
          <FolderOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm leading-tight text-foreground">{item.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.status} · {item.area}
          </p>
        </div>
      </div>
      {item.titular && (
        <p className="border-t border-border/30 pt-1.5 text-xs text-muted-foreground">
          Titular: <span className="font-semibold text-foreground">{item.titular}</span>
          {item.dni ? <span className="font-mono"> · DNI {item.dni}</span> : null}
        </p>
      )}
      <Button asChild size="sm" className="h-7 w-full text-xs font-bold rounded-xl !text-primary-foreground">
        <Link href={`/cases/${item.id}`}>
          <ExternalLink className="h-3 w-3 mr-1" /> Abrir expediente
        </Link>
      </Button>
    </div>
  );
}

function StormCard({ item }: { item: MapStormItem }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="rounded-xl p-2 shrink-0 text-white" style={{ background: STORM_COLOR }}>
          <CloudRain className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm leading-tight text-foreground">{item.nombre}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ficha de emergencia del {shortDate(item.fecha)}
          </p>
        </div>
      </div>
      <div className="space-y-1 border-t border-border/30 pt-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-semibold">{[item.domicilio, item.barrio].filter(Boolean).join(" · ")}</span>
        </p>
        <p>
          Entrega: <span className="font-semibold text-foreground">{item.entrega}</span>
        </p>
      </div>
      {item.dni && (
        <Button asChild size="sm" className="h-7 w-full text-xs font-bold rounded-xl !text-primary-foreground">
          <Link href={`/people/${item.dni}`}>
            <Network className="h-3 w-3 mr-1" /> Ver ficha
          </Link>
        </Button>
      )}
    </div>
  );
}

type Loaded =
  | { kind: "padron"; items: MapPerson[] }
  | { kind: "cases"; items: MapCaseItem[] }
  | { kind: "storm"; items: MapStormItem[] };

const GROUP_TITLE: Record<MapLayerKind, (n: number) => string> = {
  padron: (n) => `${n.toLocaleString("es-AR")} personas en este lugar`,
  cases: (n) => `${n.toLocaleString("es-AR")} expedientes abiertos en este lugar`,
  storm: (n) => `${n.toLocaleString("es-AR")} fichas de emergencia en este lugar`,
};

/** Lo que aparece al tocar un punto: los datos se piden recién ahora. */
function SelectionContent({ selection }: { selection: Selection }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const request =
      selection.kind === "padron"
        ? getMapPeopleAction(selection.ids).then((res) => (res.success ? ({ kind: "padron", items: res.people } as Loaded) : res.error))
        : getMapLayerItemsAction(selection.kind, selection.ids).then((res) =>
            res.success ? ({ kind: res.layer, items: res.items } as Loaded) : res.error
          );
    request
      .then((res) => {
        if (!alive) return;
        if (typeof res === "string") setError(res);
        else setLoaded(res);
      })
      .catch(() => alive && setError("No se pudieron cargar los datos."));
    return () => {
      alive = false;
    };
  }, [selection]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!loaded) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
      </p>
    );
  }
  if (loaded.items.length === 0) return <p className="text-xs text-muted-foreground">No se encontraron los datos.</p>;
  if (loaded.items.length === 1 && selection.total === 1) {
    if (loaded.kind === "padron") return <PersonCard person={loaded.items[0]} />;
    if (loaded.kind === "cases") return <CaseCard item={loaded.items[0]} />;
    return <StormCard item={loaded.items[0]} />;
  }

  const rows =
    loaded.kind === "padron"
      ? loaded.items.map((p) => ({
          key: p.dni,
          href: `/people/${p.dni}`,
          title: p.nombre,
          detail: `DNI ${p.dni}${p.direccion ? ` · ${p.direccion}` : ""}${p.aproximada ? " · ubicación aproximada" : ""}`,
        }))
      : loaded.kind === "cases"
        ? loaded.items.map((c) => ({
            key: c.id,
            href: `/cases/${c.id}`,
            title: c.title,
            detail: [c.titular, c.status, c.area].filter(Boolean).join(" · "),
          }))
        : loaded.items.map((f) => ({
            key: f.id,
            href: f.dni ? `/people/${f.dni}` : null,
            title: f.nombre,
            detail: `${shortDate(f.fecha)} · ${f.entrega}`,
          }));

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-foreground">
        {GROUP_TITLE[selection.kind](selection.total)}
        {selection.total > rows.length ? ` (se muestran ${rows.length})` : ""}
      </p>
      <ul className="max-h-60 overflow-y-auto divide-y divide-border/40 pr-1">
        {rows.map((r) => (
          <li key={r.key} className="py-1.5">
            {r.href ? (
              <Link href={r.href} className="block hover:underline">
                <span className="text-xs font-semibold text-foreground">{r.title}</span>
                <span className="block text-xs text-muted-foreground">{r.detail}</span>
              </Link>
            ) : (
              <>
                <span className="text-xs font-semibold text-foreground">{r.title}</span>
                <span className="block text-xs text-muted-foreground">{r.detail}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildIndex(coords: number[], include: (i: number) => boolean, count: number) {
  const features: Supercluster.PointFeature<PointProps>[] = [];
  for (let i = 0; i < count; i++) {
    if (!include(i)) continue;
    features.push({ type: "Feature", properties: { i }, geometry: { type: "Point", coordinates: [coords[i * 2 + 1], coords[i * 2]] } });
  }
  const sc = new Supercluster<PointProps>({ radius: 80, maxZoom: MAX_ZOOM });
  sc.load(features);
  return sc;
}

const pinIcon = (html: string, className: string, size: [number, number], anchor: [number, number]) =>
  L.divIcon({ html, className, iconSize: size, iconAnchor: anchor, popupAnchor: [0, -anchor[1] + 4] });

/** Una casilla de la leyenda de capas. */
function LayerRow({
  checked,
  onChange,
  disabled,
  swatch,
  label,
  count,
  hint,
  loading,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  swatch: React.ReactNode;
  label: string;
  count?: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
      />
      <span className="mt-0.5 shrink-0">{swatch}</span>
      <span className="min-w-0">
        <span className="block leading-tight">
          {label}
          {count ? <span className="font-mono text-muted-foreground"> · {count}</span> : null}
          {loading ? <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-muted-foreground" /> : null}
        </span>
        {hint ? <span className="block text-xs font-medium text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

const Dot = ({ color, dashed = false }: { color: string; dashed?: boolean }) => (
  <span
    className="block h-2.5 w-2.5 rounded-full"
    style={dashed ? { border: `2px dashed ${color}` } : { background: color }}
  />
);
const Square = () => <span className="block h-2.5 w-2.5 rounded-[3px]" style={{ background: CASE_COLOR }} />;
const Triangle = () => (
  <svg viewBox="0 0 10 9" className="block h-2.5 w-2.5" aria-hidden>
    <path d="M5 .8 9.3 8.4H.7z" fill={STORM_COLOR} strokeWidth="1.2" strokeLinejoin="round" className="dark:stroke-slate-300" />
  </svg>
);

/** "120" o "120 de 150 (30 sin dirección ubicada)". */
function layerCount(points: MapLayerPoints | null): { count?: string; hint?: string } {
  if (!points) return {};
  const located = points.ids.length;
  if (located === points.total) return { count: located.toLocaleString("es-AR") };
  const missing = points.total - located;
  return {
    count: located.toLocaleString("es-AR"),
    hint: `${missing.toLocaleString("es-AR")} sin dirección ubicada en el mapa`,
  };
}

const DEFAULT_TOGGLES: MapLayerToggles = { padron: true, cases: false, storm: false };

export function MapView({
  dnis,
  exactCount,
  coords,
  loading = false,
  center = TRES_DE_FEBRERO_CENTER,
  zoom = TRES_DE_FEBRERO_DEFAULT_ZOOM,
  viewMode = "markers",
  onViewModeChange,
  localityName = "Tres de Febrero",
  programs = [],
  programMask,
  toggles = DEFAULT_TOGGLES,
  onTogglesChange,
  caseLayer,
  stormLayer,
}: MapViewProps) {
  const [internalViewMode, setInternalViewMode] = useState<string>(viewMode);
  const [isExporting, setIsExporting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showApprox, setShowApprox] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const approxCount = dnis.length - exactCount;
  const comparing = programs.length > 0 && Array.isArray(programMask);
  const isHeat = internalViewMode !== "markers";

  useEffect(() => {
    setInternalViewMode(viewMode);
  }, [viewMode]);

  // En el celular la leyenda arranca cerrada para no tapar el mapa.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setPanelOpen(false);
  }, []);

  // Al cambiar los filtros o las capas se cierra lo que estaba abierto.
  useEffect(() => {
    setSelection(null);
  }, [dnis, caseLayer?.points, stormLayer?.points, toggles]);

  const handleModeChange = (mode: string) => {
    setInternalViewMode(mode);
    if (onViewModeChange) onViewModeChange(mode);
  };

  // En el celular la leyenda se cierra al tocar un punto, para que se vea la ficha.
  const select = (s: Selection) => {
    if (window.matchMedia("(max-width: 639px)").matches) setPanelOpen(false);
    setSelection(s);
  };

  const setToggle = (key: keyof MapLayerToggles, value: boolean) => onTogglesChange?.({ ...toggles, [key]: value });

  // Un agrupamiento para las direcciones exactas y otro para las aproximadas, así no se mezclan.
  const [exactIndex, approxIndex] = useMemo(
    () => [buildIndex(coords, (i) => i < exactCount, dnis.length), buildIndex(coords, (i) => i >= exactCount, dnis.length)],
    [dnis, coords, exactCount]
  );

  // Comparando programas: un agrupamiento por programa, con su color.
  const programIndexes = useMemo(() => {
    if (!comparing) return [];
    return programs.map((_, k) =>
      buildIndex(coords, (i) => ((programMask![i] ?? 0) & (1 << k)) !== 0 && (showApprox || i < exactCount), dnis.length)
    );
  }, [comparing, programs, programMask, coords, dnis, exactCount, showApprox]);

  const programCounts = useMemo(() => {
    if (!comparing) return [];
    return programs.map((_, k) => programMask!.reduce((n, m) => n + ((m & (1 << k)) !== 0 ? 1 : 0), 0));
  }, [comparing, programs, programMask]);

  const caseIndex = useMemo(
    () => (caseLayer?.points ? buildIndex(caseLayer.points.coords, () => true, caseLayer.points.ids.length) : null),
    [caseLayer?.points]
  );
  const stormIndex = useMemo(
    () => (stormLayer?.points ? buildIndex(stormLayer.points.coords, () => true, stormLayer.points.ids.length) : null),
    [stormLayer?.points]
  );

  const heatCoords = useMemo(() => (showApprox ? coords : coords.slice(0, exactCount * 2)), [coords, exactCount, showApprox]);

  const icons = useMemo(
    () => ({
      exact: pinIcon(svgMarkerHtml(EXACT_COLOR), "custom-municipal-marker", [26, 36], [13, 36]),
      approx: pinIcon(svgMarkerHtml(APPROX_COLOR), "custom-municipal-marker marker-approx", [26, 36], [13, 36]),
      programs: PROGRAM_COLORS.map((c) => pinIcon(svgMarkerHtml(c), "custom-municipal-marker", [26, 36], [13, 36])),
      cases: pinIcon(caseMarkerHtml, "custom-municipal-marker", [26, 26], [13, 13]),
      storm: pinIcon(stormMarkerHtml, "custom-municipal-marker", [28, 26], [14, 13]),
    }),
    []
  );

  const visibleCount =
    (toggles.padron ? dnis.length : 0) +
    (!isHeat && toggles.cases ? caseLayer?.points?.ids.length ?? 0 : 0) +
    (!isHeat && toggles.storm ? stormLayer?.points?.ids.length ?? 0 : 0);
  const onlyPadron = !toggles.cases && !toggles.storm;

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
        .map-cluster.map-cluster-approx {
          background: rgba(217, 119, 6, 0.85);
          box-shadow: 0 0 0 4px rgba(217, 119, 6, 0.25), 0 2px 6px rgba(0, 0, 0, 0.25);
          border-style: dashed;
        }
        .map-cluster.map-cluster-program {
          background: var(--cluster);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--cluster) 30%, transparent), 0 2px 6px rgba(0, 0, 0, 0.25);
        }
        .map-cluster.map-cluster-cases {
          border-radius: 10px; background: ${CASE_COLOR};
          box-shadow: 0 0 0 4px rgba(194, 65, 122, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .map-cluster.map-cluster-storm {
          border-radius: 4px; background: ${STORM_COLOR}; transform: rotate(45deg);
          box-shadow: 0 0 0 4px rgba(51, 65, 85, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .map-cluster.map-cluster-storm > span { transform: rotate(-45deg); }
      `}</style>

      <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-[1000] flex flex-col gap-2 pointer-events-none max-w-[calc(100%-1.5rem)] sm:max-w-[300px]">
        <div className="bg-background/90 backdrop-blur-md p-2.5 rounded-2xl shadow-2xl border border-border/60 pointer-events-auto flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapIcon className="h-4 w-4" />}
          </div>
          <div className="pr-1 min-w-0 flex-1">
            <p className="text-xs font-bold text-muted-foreground leading-none truncate">
              {localityName}
            </p>
            <p className="text-xs font-bold text-foreground mt-0.5">
              {loading && dnis.length === 0
                ? "Cargando las personas…"
                : onlyPadron || isHeat
                ? `${dnis.length.toLocaleString("es-AR")} ${dnis.length === 1 ? "persona" : "personas"} en el mapa`
                : `${visibleCount.toLocaleString("es-AR")} puntos en el mapa`}
            </p>
            {!isHeat && visibleCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Tocá un círculo para acercarte</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            aria-controls="mapa-capas"
            className="flex shrink-0 items-center gap-1 rounded-xl border border-border/60 px-2 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
          >
            <Layers className="h-3.5 w-3.5 text-primary" /> Capas
            <ChevronDown className={`h-3 w-3 transition-transform ${panelOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {panelOpen && (
          <div
            id="mapa-capas"
            className="bg-background/90 backdrop-blur-md px-3 py-2.5 rounded-2xl shadow-2xl border border-border/60 pointer-events-auto space-y-2 text-xs font-semibold text-foreground max-h-[420px] overflow-y-auto"
          >
            <LayerRow
              checked={toggles.padron}
              onChange={(v) => setToggle("padron", v)}
              swatch={<Dot color={comparing ? PROGRAM_COLORS[0] : EXACT_COLOR} />}
              label="Personas del padrón"
              count={dnis.length.toLocaleString("es-AR")}
            />

            {toggles.padron && (
              <div className="ml-5 space-y-1.5 border-l border-border/60 pl-2.5">
                {comparing ? (
                  programs.map((name, k) => (
                    <p key={name} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">
                        <Dot color={PROGRAM_COLORS[k]} />
                      </span>
                      <span className="min-w-0 leading-tight">
                        {name}
                        <span className="font-mono text-muted-foreground"> · {programCounts[k].toLocaleString("es-AR")}</span>
                      </span>
                    </p>
                  ))
                ) : (
                  <p className="flex items-center gap-2">
                    <Dot color={EXACT_COLOR} />
                    Dirección exacta: {exactCount.toLocaleString("es-AR")}
                  </p>
                )}
                {approxCount > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showApprox}
                      onChange={(e) => setShowApprox(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-600"
                      aria-label="Mostrar las ubicaciones aproximadas (solo barrio)"
                    />
                    {comparing ? null : <Dot color={APPROX_COLOR} dashed />}
                    Aproximadas, solo barrio: {approxCount.toLocaleString("es-AR")}
                  </label>
                )}
              </div>
            )}

            <LayerRow
              checked={toggles.cases}
              onChange={(v) => setToggle("cases", v)}
              disabled={isHeat}
              swatch={<Square />}
              label="Expedientes abiertos"
              loading={caseLayer?.loading}
              {...(toggles.cases && !isHeat ? layerCount(caseLayer?.points ?? null) : {})}
            />
            <LayerRow
              checked={toggles.storm}
              onChange={(v) => setToggle("storm", v)}
              disabled={isHeat}
              swatch={<Triangle />}
              label="Fichas de emergencia climática"
              loading={stormLayer?.loading}
              {...(toggles.storm && !isHeat ? layerCount(stormLayer?.points ?? null) : {})}
            />
            {isHeat ? (
              <p className="text-xs font-medium text-muted-foreground">El mapa de calor muestra solo al padrón. Pasá a Puntos para ver las otras capas.</p>
            ) : (toggles.cases || toggles.storm) ? (
              <p className="text-xs font-medium text-muted-foreground">Expedientes y fichas se ubican en la dirección de la persona.</p>
            ) : null}
          </div>
        )}
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
          {isExporting ? "Exportando mapa…" : "Guardar imagen del mapa"}
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

          {toggles.padron && !comparing && showApprox && approxCount > 0 && (
            <ClusterLayer index={approxIndex} ids={dnis} coords={coords} icon={icons.approx} variant="approx" kind="padron" onSelect={select} />
          )}
          {toggles.padron && !comparing && (
            <ClusterLayer index={exactIndex} ids={dnis} coords={coords} icon={icons.exact} variant="exact" kind="padron" onSelect={select} />
          )}
          {toggles.padron &&
            comparing &&
            programIndexes.map((index, k) => (
              <ClusterLayer
                key={programs[k]}
                index={index}
                ids={dnis}
                coords={coords}
                icon={icons.programs[k]}
                variant="program"
                color={PROGRAM_COLORS[k]}
                label={programs[k]}
                kind="padron"
                onSelect={select}
              />
            ))}
          {toggles.cases && caseIndex && caseLayer?.points && (
            <ClusterLayer
              index={caseIndex}
              ids={caseLayer.points.ids}
              coords={caseLayer.points.coords}
              icon={icons.cases}
              variant="cases"
              kind="cases"
              label="Expediente abierto"
              zIndexOffset={1000}
              onSelect={select}
            />
          )}
          {toggles.storm && stormIndex && stormLayer?.points && (
            <ClusterLayer
              index={stormIndex}
              ids={stormLayer.points.ids}
              coords={stormLayer.points.coords}
              icon={icons.storm}
              variant="storm"
              kind="storm"
              label="Ficha de emergencia climática"
              zIndexOffset={2000}
              onSelect={select}
            />
          )}

          {selection && (
            <Popup
              key={`${selection.kind},${selection.lat},${selection.lon},${selection.ids[0]}`}
              position={[selection.lat, selection.lon]}
              className="custom-popup"
              // Que la ficha no quede debajo de la leyenda de capas.
              autoPanPaddingTopLeft={panelOpen ? [330, 24] : [24, 110]}
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
        <HeatmapView coords={heatCoords} center={center} zoom={zoom} />
      )}
    </div>
  );
}
