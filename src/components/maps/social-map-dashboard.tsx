"use client";

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
  Building2, Sparkles, HeartHandshake, MapPinned, Info
} from "lucide-react";
import { MUNICIPAL_LOCALITIES } from "@/lib/constants/localities";
import type { MapFilters } from "@/lib/map-filters";
import type { MapData } from "@/services/map";
import { getMapDataAction, getMapExportAction } from "@/app/(dashboard)/maps/actions";

const DynamicMapView = dynamic(
  () => import("@/components/maps/map-view").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-[620px] w-full rounded-2xl bg-muted/40 animate-pulse flex flex-col items-center justify-center gap-2">
        <MapIcon className="h-8 w-8 text-primary animate-bounce" />
        <p className="text-xs font-bold text-muted-foreground">
          Cargando Cartografía Social Tres de Febrero...
        </p>
      </div>
    )
  }
);

interface SocialMapDashboardProps {
  initialData: MapData;
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

export function SocialMapDashboard({ initialData, programs, unlocated = 0, canLocate = false, canExport = false }: SocialMapDashboardProps) {
  const [selectedLocalityId, setSelectedLocalityId] = useState<string>("all");
  const [selectedProgram, setSelectedProgram] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<string>("markers");
  const [data, setData] = useState<MapData>(initialData);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const firstRender = useRef(true);

  const selectedLocality = useMemo(
    () => MUNICIPAL_LOCALITIES.find((l) => l.id === selectedLocalityId) || MUNICIPAL_LOCALITIES[0],
    [selectedLocalityId]
  );

  const filters: MapFilters = useMemo(
    () => ({ localityId: selectedLocalityId, program: selectedProgram, query: debouncedQuery }),
    [selectedLocalityId, selectedProgram, debouncedQuery]
  );

  // La búsqueda por texto espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Los filtros se resuelven en el servidor; si llegan dos respuestas, vale la última.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const request = ++requestRef.current;
    setLoading(true);
    getMapDataAction(filters)
      .then((res) => {
        if (request !== requestRef.current) return;
        if (res.success) setData(res.data);
        else toast.error(res.error);
      })
      .catch(() => request === requestRef.current && toast.error("No se pudo cargar el mapa. Probá de nuevo."))
      .finally(() => request === requestRef.current && setLoading(false));
  }, [filters]);

  const handleResetFilters = () => {
    setSelectedLocalityId("all");
    setSelectedProgram("all");
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
    { header: "Longitud", accessorKey: "longitude" }
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
        title="Cartografía Social GIS 3F"
        description="Monitoreo territorial, geolocalización de vecinos asistidos y densidad de cobertura socio-barrial."
        icon={MapPin}
        badge="Georreferenciación Localidades"
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
                title={`Cartografía Social y Padrón Georreferenciado - ${selectedLocality.name}`}
                subtitle="MUNICIPALIDAD DE TRES DE FEBRERO"
                label="Exportar Padrón Zona"
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
            <label htmlFor="mapa-localidad" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Localidad Oficial
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
            <label htmlFor="mapa-programa" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <HeartHandshake className="h-3.5 w-3.5 text-emerald-500" /> Programa Social
            </label>
            <select
              id="mapa-programa"
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full h-10 px-3 rounded-2xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todos los programas activos</option>
              {programs.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="mapa-busqueda" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-blue-500" /> Búsqueda por Texto
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
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> Restablecer Filtros
            </Button>
          </div>
        </div>
      </Card>

      <div className={`grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        <StatCard
          label="Vecinos en Zona"
          value={<span className="font-mono">{fmt(stats.total)}</span>}
          hint="Personas del padrón con estos filtros"
          icon={Users}
          tone="blue"
        />

        <StatCard
          label="Puntos GPS Activos"
          value={<span className="font-mono">{fmt(stats.located)}</span>}
          hint={<span className="font-bold text-emerald-500">{stats.total > 0 ? `${locatedPct}% ubicadas en el mapa` : "Sin personas"}</span>}
          icon={MapPin}
          tone="green"
        />

        <StatCard
          label="Sector Dominante"
          value={<span className="block truncate text-base sm:text-lg" title={stats.topBarrio}>{stats.topBarrio}</span>}
          hint="Barrio con más personas"
          icon={Building2}
          tone="orange"
        />

        <StatCard
          label="Programa Principal"
          value={<span className="block truncate text-base sm:text-lg" title={stats.topProgram}>{stats.topProgram}</span>}
          hint={<span className="font-bold text-blue-500">Cobertura socio-asistencial</span>}
          icon={Sparkles}
          tone="purple"
        />
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden p-2">
        <DynamicMapView
          dnis={data.dnis}
          coords={data.coords}
          loading={loading}
          center={selectedLocality.coordinates}
          zoom={selectedLocality.zoom}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          localityName={selectedLocality.name}
        />
      </Card>
    </div>
  );
}
