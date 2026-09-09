"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, HeartHandshake, X, RotateCcw, Filter, ListOrdered } from "lucide-react";

interface PeopleFiltersProps {
  barrios: string[];
  programas: string[];
}

export function PeopleFilters({ barrios, programas }: PeopleFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("search") || "";
  const currentBarrio = searchParams.get("barrio") || "all";
  const currentPrograma = searchParams.get("programa") || "all";
  const currentLimit = searchParams.get("limit") || "20";

  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Resetear a pagina 1 siempre que cambie un filtro
    params.set("page", "1");

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput.trim() });
  };

  const clearAllFilters = () => {
    setSearchInput("");
    router.push(pathname);
  };

  const hasActiveFilters =
    Boolean(currentSearch) ||
    (currentBarrio && currentBarrio !== "all") ||
    (currentPrograma && currentPrograma !== "all") ||
    (currentLimit && currentLimit !== "20");

  return (
    <Card className="p-5 bg-card text-card-foreground border border-border/60 rounded-3xl shadow-xs space-y-4">
      <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por DNI, Apellido, Nombre o Dirección..."
            className="pl-10 h-11 rounded-2xl border-border/60 bg-muted/20 text-xs font-semibold focus-visible:ring-primary"
          />
        </div>

        <div className="lg:col-span-3">
          <select
            value={currentBarrio}
            onChange={(e) => updateFilters({ barrio: e.target.value })}
            className="w-full h-11 px-3 rounded-2xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todas las Localidades / Barrios</option>
            {barrios.map((b, idx) => (
              <option key={idx} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <select
            value={currentPrograma}
            onChange={(e) => updateFilters({ programa: e.target.value })}
            className="w-full h-11 px-3 rounded-2xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos los Programas Sociales</option>
            {programas.map((p, idx) => (
              <option key={idx} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1 flex items-center gap-2">
          <Button type="submit" className="h-11 w-full rounded-2xl px-4 text-xs font-bold bg-primary text-primary-foreground">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-primary" /> Filtros Activos:
          </span>

          {currentSearch && (
            <Badge variant="secondary" className="gap-1 rounded-xl text-xs bg-primary/10 text-primary border border-primary/20 font-bold">
              Búsqueda: {currentSearch}
              <button type="button" onClick={() => updateFilters({ search: null })} className="ml-1 hover:text-rose-500">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {currentBarrio && currentBarrio !== "all" && (
            <Badge variant="secondary" className="gap-1 rounded-xl text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
              Barrio: {currentBarrio}
              <button type="button" onClick={() => updateFilters({ barrio: null })} className="ml-1 hover:text-rose-500">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {currentPrograma && currentPrograma !== "all" && (
            <Badge variant="secondary" className="gap-1 rounded-xl text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
              Programa: {currentPrograma}
              <button type="button" onClick={() => updateFilters({ programa: null })} className="ml-1 hover:text-rose-500">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {!hasActiveFilters && (
            <span className="text-muted-foreground text-xs italic">Sin filtros aplicados</span>
          )}

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-7 text-[11px] font-bold text-muted-foreground hover:text-destructive rounded-xl"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Limpiar Todo
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <ListOrdered className="h-3.5 w-3.5" /> Filas:
          </span>
          <select
            value={currentLimit}
            onChange={(e) => updateFilters({ limit: e.target.value })}
            className="h-8 px-2 rounded-xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="15">15 por pág.</option>
            <option value="20">20 por pág.</option>
            <option value="30">30 por pág.</option>
            <option value="50">50 por pág.</option>
          </select>
        </div>
      </div>
    </Card>
  );
}
