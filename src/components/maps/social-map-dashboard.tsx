"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  MapPin, Users, Filter, Search, RotateCcw, Map as MapIcon,
  Flame, Layers, Building2, Sparkles, HeartHandshake, MapPinned, Info
} from "lucide-react";
import {
  MUNICIPAL_LOCALITIES,
  TRES_DE_FEBRERO_CENTER,
  TRES_DE_FEBRERO_DEFAULT_ZOOM,
  LocalityInfo
} from "@/lib/constants/localities";

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
  initialPeople: any[];
  stats: {
    total: number;
    avgAge: number;
    topArea: string;
    localityTotals?: Record<string, number>;
  };
  /** Personas del padrón que todavía no tienen un punto en el mapa. */
  unlocated?: number;
  /** Puede abrir "Ubicar en el mapa" (conducción). */
  canLocate?: boolean;
}

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function SocialMapDashboard({ initialPeople, stats, unlocated = 0, canLocate = false }: SocialMapDashboardProps) {
  const [selectedLocalityId, setSelectedLocalityId] = useState<string>("all");
  const [selectedProgram, setSelectedProgram] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<string>("markers");

  const selectedLocality = useMemo(() => {
    return (
      MUNICIPAL_LOCALITIES.find((l) => l.id === selectedLocalityId) ||
      MUNICIPAL_LOCALITIES[0]
    );
  }, [selectedLocalityId]);

  const allAvailablePrograms = useMemo(() => {
    const progsSet = new Set<string>();
    initialPeople.forEach((p) => {
      if (p.programasActivos && Array.isArray(p.programasActivos)) {
        p.programasActivos.forEach((prog: string) => progsSet.add(prog));
      }
    });
    return Array.from(progsSet).sort();
  }, [initialPeople]);

  const filteredPeople = useMemo(() => {
    return initialPeople.filter((p) => {
      if (selectedLocalityId !== "all") {
        const pLoc = (p.localidad || "").toLowerCase();
        const pBarrio = (p.barrio || "").toLowerCase();
        const pAddress = (p.address || "").toLowerCase();

        let matchesLoc = false;

        if (selectedLocalityId === "caseros") {
          matchesLoc =
            pLoc.includes("caseros") ||
            pBarrio.includes("caseros") ||
            pAddress.includes("caseros") ||
            pBarrio.includes("derqui");
        } else if (selectedLocalityId === "barrio-derqui") {
          matchesLoc =
            pBarrio.includes("derqui") ||
            pAddress.includes("derqui") ||
            pLoc.includes("derqui");
        } else if (selectedLocalityId === "barrio-el-libertador") {
          matchesLoc =
            pBarrio.includes("libertador") ||
            pLoc.includes("libertador") ||
            pAddress.includes("libertador");
        } else if (selectedLocalityId === "barrio-puerta-8") {
          matchesLoc =
            pBarrio.includes("puerta 8") ||
            pBarrio.includes("puerta ocho") ||
            pAddress.includes("puerta 8") ||
            pLoc.includes("puerta 8");
        } else if (selectedLocalityId === "ciudadela") {
          matchesLoc =
            (pLoc.includes("ciudadela") || pBarrio.includes("ciudadela") || pAddress.includes("ciudadela")) &&
            !pBarrio.includes("norte") &&
            !pBarrio.includes("sur") &&
            !pBarrio.includes("ejército") &&
            !pBarrio.includes("ejercito") &&
            !pBarrio.includes("apache");
        } else if (selectedLocalityId === "ciudadela-norte") {
          matchesLoc =
            pLoc.includes("ciudadela norte") ||
            pBarrio.includes("ciudadela norte") ||
            (pBarrio.includes("norte") && (pLoc.includes("ciudadela") || pAddress.includes("ciudadela")));
        } else if (selectedLocalityId === "ciudadela-sur") {
          matchesLoc =
            pLoc.includes("ciudadela sur") ||
            pBarrio.includes("ciudadela sur") ||
            (pBarrio.includes("sur") && (pLoc.includes("ciudadela") || pAddress.includes("ciudadela")));
        } else if (selectedLocalityId === "ejercito-de-los-andes") {
          matchesLoc =
            pBarrio.includes("ejército") ||
            pBarrio.includes("ejercito") ||
            pBarrio.includes("andes") ||
            pBarrio.includes("apache") ||
            pLoc.includes("ejército") ||
            pLoc.includes("apache");
        } else {
          const cleanLocalitySimple = selectedLocality.name.split("(")[0].trim().toLowerCase();
          matchesLoc =
            pLoc.includes(cleanLocalitySimple) ||
            pBarrio.includes(cleanLocalitySimple) ||
            pAddress.includes(cleanLocalitySimple);
        }

        // GPS Proximity Fallback (~1.8 km) if coordinates exist
        if (!matchesLoc && p.latitude && p.longitude) {
          const dist = calculateHaversineDistance(
            selectedLocality.coordinates[0],
            selectedLocality.coordinates[1],
            p.latitude,
            p.longitude
          );
          if (dist <= 1.8) {
            matchesLoc = true;
          }
        }

        if (!matchesLoc) return false;
      }

      if (selectedProgram !== "all") {
        const hasProg = p.programasActivos?.includes(selectedProgram);
        if (!hasProg) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
        const matchDni = p.dni.includes(q);
        const matchAddress = (p.address || "").toLowerCase().includes(q);
        const matchBarrio = (p.barrio || "").toLowerCase().includes(q);
        if (!matchName && !matchDni && !matchAddress && !matchBarrio) return false;
      }

      return true;
    });
  }, [initialPeople, selectedLocalityId, selectedLocality, selectedProgram, searchQuery]);

  const georeferencedFiltered = useMemo(() => {
    return filteredPeople.filter((p) => p.latitude && p.longitude);
  }, [filteredPeople]);

  const topBarrio = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPeople.forEach((p) => {
      const b = p.barrio || p.localidad || "Caseros";
      counts[b] = (counts[b] || 0) + 1;
    });
    let top = "Sin datos";
    let max = 0;
    Object.entries(counts).forEach(([k, v]) => {
      if (v > max) {
        max = v;
        top = k;
      }
    });
    return top;
  }, [filteredPeople]);

  const topProgram = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPeople.forEach((p) => {
      if (p.programasActivos && Array.isArray(p.programasActivos)) {
        p.programasActivos.forEach((prog: string) => {
          counts[prog] = (counts[prog] || 0) + 1;
        });
      }
    });
    let top = "Desarrollo Humano";
    let max = 0;
    Object.entries(counts).forEach(([k, v]) => {
      if (v > max) {
        max = v;
        top = k;
      }
    });
    return top;
  }, [filteredPeople]);

  const handleResetFilters = () => {
    setSelectedLocalityId("all");
    setSelectedProgram("all");
    setSearchQuery("");
  };

  const exportColumns = [
    { header: "Apellido y Nombre", accessorKey: "name" },
    { header: "DNI", accessorKey: "dni" },
    { header: "Localidad / Barrio", accessorKey: "barrio" },
    { header: "Domicilio", accessorKey: "address" },
    { header: "Programas Activos", accessorKey: "programasStr" },
    { header: "Latitud", accessorKey: "latitude" },
    { header: "Longitud", accessorKey: "longitude" }
  ];

  const exportData = filteredPeople.map((p) => ({
    name: `${p.lastName}, ${p.firstName}`,
    dni: p.dni,
    barrio: p.barrio || p.localidad || "No especificado",
    address: p.address || "Sin dirección",
    programasStr: p.programasActivos?.join(" | ") || "Ninguno",
    latitude: p.latitude || "N/R",
    longitude: p.longitude || "N/R"
  }));

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
          <UniversalExportMenu
            data={exportData}
            columns={exportColumns}
            filename={`mapa_social_${selectedLocality.id}_3f`}
            title={`Cartografía Social y Padrón Georreferenciado - ${selectedLocality.name}`}
            subtitle="MUNICIPALIDAD DE TRES DE FEBRERO"
            label="Exportar Padrón Zona"
          />
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
                  : `Faltan ubicar ${unlocated.toLocaleString("es-AR")} personas del padrón.`}
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Localidad Oficial
            </label>
            <select
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <HeartHandshake className="h-3.5 w-3.5 text-emerald-500" /> Programa Social
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full h-10 px-3 rounded-2xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todos los programas activos</option>
              {allAvailablePrograms.map((prog, idx) => (
                <option key={idx} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-blue-500" /> Búsqueda por Texto
            </label>
            <Input
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Vecinos en Zona"
          value={
            <span className="font-mono">
              {(
                selectedLocalityId === "all"
                  ? (stats?.total ?? 0)
                  : (stats?.localityTotals?.[selectedLocalityId] || filteredPeople.length)
              ).toLocaleString("es-AR")}
            </span>
          }
          hint="Población censada en padrón"
          icon={Users}
          tone="blue"
        />

        <StatCard
          label="Puntos GPS Activos"
          value={georeferencedFiltered.length}
          hint={
            <span className="font-bold text-emerald-500">
              {initialPeople.length + unlocated > 0
                ? `${Math.round((initialPeople.length / (initialPeople.length + unlocated)) * 100)}% del padrón ubicado`
                : "Sin personas ubicadas"}
            </span>
          }
          icon={MapPin}
          tone="green"
        />

        <StatCard
          label="Sector Dominante"
          value={<span className="block truncate text-base sm:text-lg" title={topBarrio}>{topBarrio}</span>}
          hint="Barrio con mayor demanda"
          icon={Building2}
          tone="orange"
        />

        <StatCard
          label="Programa Principal"
          value={<span className="block truncate text-base sm:text-lg" title={topProgram}>{topProgram}</span>}
          hint={<span className="font-bold text-blue-500">Cobertura socio-asistencial</span>}
          icon={Sparkles}
          tone="purple"
        />
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden p-2">
        <DynamicMapView
          people={georeferencedFiltered}
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
