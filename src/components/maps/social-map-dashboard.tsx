"use client";

import { MapPlaceholder } from "@/components/layout/page-skeletons";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  MapPin, Users, Search, RotateCcw, Map as MapIcon,
  Building2, Sparkles, HeartHandshake, MapPinned, Info, X
} from "lucide-react";
import { MUNICIPAL_LOCALITIES } from "@/lib/constants/localities";
import { MAP_MAX_PROGRAMS, type MapFilters } from "@/lib/map-filters";
import { PROGRAM_COLORS } from "@/lib/map-colors";
import { emptyMapData, unpackMapData, type MapData, type MapStats } from "@/lib/map-points";
import type { MapLayerKey, MapLayerPoints } from "@/services/map-layers";
import type { MapLayerToggles } from "@/components/maps/map-view";
import { getMapDataAction, getMapExportAction, getMapLayerAction } from "@/app/(dashboard)/maps/actions";

const DynamicMapView = dynamic(
  () => import("@/components/maps/map-view").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => <MapPlaceholder height={620} label="Cargando el mapa de Tres de Febrero…" />
  }
);

interface SocialMapDashboardProps {
  /** Cifras del padrón sin filtros; los puntos se piden al abrir la página. */
  initialStats: MapStats;
  /** Programas del padrón, para el filtro. */
  programs: string[];
  /** Personas del padrón que todavía no tienen un punto en el mapa. */
  unlocated?: number;
  /** Puede abrir "Ubicar en el mapa" (conducción). */
  canLocate?: boolean;
  /** Puede bajar la planilla con nombres y direcciones. */
  canExport?: boolean;
}

const fmt = (n: number) => n.toLocaleString("es-AR");

export function SocialMapDashboard({ initialStats, programs, unlocated = 0, canLocate = false, canExport = false }: SocialMapDashboardProps) {
  const [selectedLocalityId, setSelectedLocalityId] = useState<string>("all");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<string>("markers");
  const [data, setData] = useState<MapData>(() => emptyMapData(initialStats));
  // Los programas con los que se armaron los datos que se ven (los colores siguen a esta lista).
  const [dataPrograms, setDataPrograms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);
  const [toggles, setToggles] = useState<MapLayerToggles>({ padron: true, cases: false, storm: false });
  const [layers, setLayers] = useState<Record<MapLayerKey, { points: MapLayerPoints | null; loading: boolean }>>({
    cases: { points: null, loading: false },
    storm: { points: null, loading: false },
  });
  const layerRequests = useRef<Record<MapLayerKey, number>>({ cases: 0, storm: 0 });

  const selectedLocality = useMemo(
    () => MUNICIPAL_LOCALITIES.find((l) => l.id === selectedLocalityId) || MUNICIPAL_LOCALITIES[0],
    [selectedLocalityId]
  );

  const filters: MapFilters = useMemo(
    () => ({ localityId: selectedLocalityId, programs: selectedPrograms, query: debouncedQuery }),
    [selectedLocalityId, selectedPrograms, debouncedQuery]
  );

  // La búsqueda por texto espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Los puntos se piden al abrir la página y cada vez que cambian los filtros (se resuelven
  // en el servidor); si llegan dos respuestas, vale la última.
  useEffect(() => {
    const request = ++requestRef.current;
    setLoading(true);
    getMapDataAction(filters)
      .then((res) => {
        if (request !== requestRef.current) return;
        if (res.success) {
          setData(unpackMapData(res.data));
          setDataPrograms(filters.programs ?? []);
        } else toast.error(res.error);
      })
      .catch(() => request === requestRef.current && toast.error("No se pudo cargar el mapa. Probá de nuevo."))
      .finally(() => request === requestRef.current && setLoading(false));
  }, [filters]);

  // Expedientes y fichas: se piden recién cuando se prenden, y otra vez si cambian los filtros.
  useEffect(() => {
    (["cases", "storm"] as MapLayerKey[]).forEach((layer) => {
      if (!toggles[layer]) return;
      const request = ++layerRequests.current[layer];
      setLayers((prev) => ({ ...prev, [layer]: { ...prev[layer], loading: true } }));
      getMapLayerAction(layer, filters)
        .then((res) => {
          if (request !== layerRequests.current[layer]) return;
          if (res.success) setLayers((prev) => ({ ...prev, [layer]: { points: res.points, loading: false } }));
          else {
            toast.error(res.error);
            setLayers((prev) => ({ ...prev, [layer]: { ...prev[layer], loading: false } }));
          }
        })
        .catch(() => {
          if (request !== layerRequests.current[layer]) return;
          toast.error("No se pudo cargar la capa. Probá de nuevo.");
          setLayers((prev) => ({ ...prev, [layer]: { ...prev[layer], loading: false } }));
        });
    });
  }, [filters, toggles.cases, toggles.storm]); // eslint-disable-line react-hooks/exhaustive-deps

  const addProgram = (name: string) => {
    if (!name) return;
    setSelectedPrograms((prev) => (prev.includes(name) || prev.length >= MAP_MAX_PROGRAMS ? prev : [...prev, name]));
  };
  const removeProgram = (name: string) => setSelectedPrograms((prev) => prev.filter((p) => p !== name));

  const handleResetFilters = () => {
    setSelectedLocalityId("all");
    setSelectedPrograms([]);
    setSearchQuery("");
  };

  const { stats } = data;
  const locatedPct =
    stats.total === 0 ? 0 : stats.located === stats.total ? 100 : Math.min(99, Math.round((stats.located / stats.total) * 100));

  const exportColumns = [
    { header: "Apellido y Nombre", accessorKey: "name" },
    { header: "DNI", accessorKey: "dni" },
    { header: "Localidad / Barrio", accessorKey: "barrio" },
    { header: "Dirección", accessorKey: "address" },
    { header: "Programas Activos", accessorKey: "programasStr" },
    { header: "Latitud", accessorKey: "latitude" },
    { header: "Longitud", accessorKey: "longitude" },
    { header: "Ubicación", accessorKey: "ubicacion" }
  ];

  const loadExportRows = async () => {
    const res = await getMapExportAction(filters);
    if (!res.success) {
      toast.error(res.error);
      return null;
    }
    return res.rows;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <PageHeader
        title="Mapa Social"
        description="Dónde vive la gente del padrón, por localidad, barrio y programa."
        icon={MapPin}
        actions={
          <>
            {canLocate && (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/maps/ubicar">
                  <MapPinned className="h-4 w-4" /> Ubicar en el mapa
                </Link>
              </Button>
            )}
            {canExport && (
              <UniversalExportMenu
                data={[]}
                loadData={loadExportRows}
                pdfMaxRows={5000}
                columns={exportColumns}
                filename={`mapa_social_${selectedLocality.id}_3f`}
                title={`Mapa Social - ${selectedLocality.name}`}
                subtitle="MUNICIPALIDAD DE TRES DE FEBRERO"
                label="Exportar esta zona"
              />
            )}
          </>
        }
      />

      {unlocated > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-foreground">
              <span className="font-bold">
                {unlocated === 1
                  ? "Falta ubicar 1 persona del padrón."
                  : `Faltan ubicar ${fmt(unlocated)} personas del padrón.`}
              </span>{" "}
              El mapa muestra solo los puntos reales: {unlocated === 1 ? "esa persona aparece" : "esas personas aparecen"} cuando se ubica su dirección.
            </p>
          </div>
          {canLocate && (
            <Button asChild size="sm" className="shrink-0 rounded-xl">
              <Link href="/maps/ubicar">
                <MapPinned className="h-4 w-4" /> Ir a ubicar
              </Link>
            </Button>
          )}
        </div>
      )}

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label htmlFor="mapa-localidad" className="text-xs font-bold text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Localidad oficial
            </label>
            <select
              id="mapa-localidad"
              value={selectedLocalityId}
              onChange={(e) => setSelectedLocalityId(e.target.value)}
              className="w-full h-10 px-3 rounded-2xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {MUNICIPAL_LOCALITIES.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="mapa-programa" className="text-xs font-bold text-muted-foreground flex items-center gap-1">
              <HeartHandshake className="h-3.5 w-3.5 text-emerald-500" /> Programas (hasta {MAP_MAX_PROGRAMS})
            </label>
            <select
              id="mapa-programa"
              value=""
              onChange={(e) => addProgram(e.target.value)}
              disabled={selectedPrograms.length >= MAP_MAX_PROGRAMS}
              className="w-full h-10 px-3 rounded-2xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            >
              <option value="">
                {selectedPrograms.length === 0
                  ? "Todos los programas"
                  : selectedPrograms.length >= MAP_MAX_PROGRAMS
                    ? "Ya elegiste 3 programas"
                    : "Sumar otro programa"}
              </option>
              {programs
                .filter((prog) => !selectedPrograms.includes(prog))
                .map((prog) => (
                  <option key={prog} value={prog}>
                    {prog}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="mapa-busqueda" className="text-xs font-bold text-muted-foreground flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-blue-500" /> Búsqueda por texto
            </label>
            <Input
              id="mapa-busqueda"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por vecino, DNI o calle..."
              className="h-10 text-xs rounded-2xl bg-muted/30 border-border/60 text-foreground font-medium"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetFilters}
              className="w-full h-10 rounded-2xl text-xs font-bold border-border/60 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> Restablecer filtros
            </Button>
          </div>
        </div>
        {selectedPrograms.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Comparando:</span>
            {selectedPrograms.map((prog, k) => (
              <span
                key={prog}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 py-1 pl-2.5 pr-1 text-xs font-semibold text-foreground"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PROGRAM_COLORS[k] }} />
                <span className="truncate">{prog}</span>
                <button
                  type="button"
                  onClick={() => removeProgram(prog)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Quitar ${prog}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className={`grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        <StatCard
          label="Vecinos en zona"
          value={<span className="font-mono">{fmt(stats.total)}</span>}
          hint="Personas del padrón con estos filtros"
          icon={Users}
          tone="blue"
        />

        <StatCard
          label="Puntos GPS activos"
          value={<span className="font-mono">{fmt(stats.located)}</span>}
          hint={
            stats.total > 0 ? (
              <span className="block">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{locatedPct}% ubicadas en el mapa</span>
                {stats.approximate > 0 && (
                  <span className="block font-semibold text-amber-700 dark:text-amber-400">
                    {fmt(stats.approximate)} aproximadas (solo barrio)
                  </span>
                )}
              </span>
            ) : (
              "Sin personas"
            )
          }
          icon={MapPin}
          tone="green"
        />

        <StatCard
          label="Sector dominante"
          value={<span className="block truncate text-base sm:text-lg" title={stats.topBarrio}>{stats.topBarrio}</span>}
          hint="Barrio con más personas"
          icon={Building2}
          tone="orange"
        />

        <StatCard
          label="Programa principal"
          value={<span className="block truncate text-base sm:text-lg" title={stats.topProgram}>{stats.topProgram}</span>}
          hint={<span className="font-bold text-blue-700 dark:text-blue-400">Cobertura socio-asistencial</span>}
          icon={Sparkles}
          tone="purple"
        />
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden p-2">
        <DynamicMapView
          dnis={data.dnis}
          exactCount={data.exactCount}
          coords={data.coords}
          loading={loading}
          center={selectedLocality.coordinates}
          zoom={selectedLocality.zoom}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          localityName={selectedLocality.name}
          programs={dataPrograms}
          programMask={data.programMask}
          toggles={toggles}
          onTogglesChange={setToggles}
          caseLayer={layers.cases}
          stormLayer={layers.storm}
        />
      </Card>
    </div>
  );
}
