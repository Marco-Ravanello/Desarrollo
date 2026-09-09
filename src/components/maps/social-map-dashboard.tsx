"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import {
  MapPin, Users, Filter, Search, RotateCcw, Map as MapIcon,
  Flame, Layers, Building2, Sparkles, HeartHandshake
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
      <div className="h-[620px] w-full rounded-3xl bg-muted/40 animate-pulse flex flex-col items-center justify-center gap-2">
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
  };
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

export function SocialMapDashboard({ initialPeople, stats }: SocialMapDashboardProps) {
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

        if (selectedLocalityId === "ciudadela") {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              Cartografía Social GIS 3F
              <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
                Georreferenciación Localidades
              </Badge>
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoreo territorial, geolocalización de vecinos asistidos y densidad de cobertura socio-barrial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <UniversalExportMenu
            data={exportData}
            columns={exportColumns}
            filename={`mapa_social_${selectedLocality.id}_3f`}
            title={`Cartografía Social y Padrón Georreferenciado - ${selectedLocality.name}`}
            subtitle="MUNICIPALIDAD DE TRES DE FEBRERO"
            label="Exportar Padrón Zona"
          />
        </div>
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
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
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
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
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Vecinos Filtrados</p>
            <h3 className="text-2xl font-black text-foreground mt-1">{filteredPeople.length}</h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">En zona seleccionada</p>
          </div>
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Users className="h-6 w-6" />
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Puntos GPS Activos</p>
            <h3 className="text-2xl font-black text-foreground mt-1">{georeferencedFiltered.length}</h3>
            <p className="text-[10px] text-emerald-500 font-bold mt-0.5">
              {filteredPeople.length > 0
                ? `${Math.round((georeferencedFiltered.length / filteredPeople.length) * 100)}% georreferenciados`
                : "0%"}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <MapPin className="h-6 w-6" />
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Sector Dominante</p>
            <h3 className="text-base font-black text-foreground mt-1 truncate max-w-[140px]">{topBarrio}</h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Barrio con mayor demanda</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Building2 className="h-6 w-6" />
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Programa Principal</p>
            <h3 className="text-base font-black text-foreground mt-1 truncate max-w-[140px]">{topProgram}</h3>
            <p className="text-[10px] text-blue-500 font-bold mt-0.5">Cobertura socio-asistencial</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
        </Card>
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden p-2">
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
