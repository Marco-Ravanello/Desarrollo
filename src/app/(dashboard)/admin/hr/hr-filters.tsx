"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function HRFilters({ areas }: { areas: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || "");
  const [areaId, setAreaId] = useState(searchParams.get('area') || "all");
  const [status, setStatus] = useState(searchParams.get('status') || "all");

  const updateFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === "all" || !value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/admin/hr?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: query });
  };

  const clearFilters = () => {
    setQuery("");
    setAreaId("all");
    setStatus("all");
    router.push("/admin/hr");
  };

  return (
    <div className="p-4 sm:p-5 border-b border-border/50 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_16rem_12rem_auto] items-center">
      <form onSubmit={handleSearch} className="relative w-full sm:col-span-2 lg:col-span-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, DNI o legajo..."
          className="pl-11 h-10 rounded-xl bg-background border-border/60 focus-visible:ring-2 focus-visible:ring-primary font-medium"
          aria-label="Buscar personal"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
            <button type="button" onClick={() => {setQuery(""); updateFilters({q: ""})}} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full">
                <X className="h-3 w-3" />
            </button>
        )}
      </form>

              <select
          aria-label="Filtrar por área"
          className="h-10 w-full min-w-0 truncate px-3 rounded-xl bg-background border border-border/60 font-medium text-sm text-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
          value={areaId}
          onChange={(e) => {
            setAreaId(e.target.value);
            updateFilters({ area: e.target.value });
          }}
        >
          <option value="all">Todas las áreas</option>
          {areas.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar por situación"
          className="h-10 w-full min-w-0 px-3 rounded-xl bg-background border border-border/60 font-medium text-sm text-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            updateFilters({ status: e.target.value });
          }}
        >
          <option value="all">Todas las situaciones</option>
          <option value="ACTIVO">Activo</option>
          <option value="LICENCIA">Licencia</option>
          <option value="VACACIONES">Vacaciones</option>
          <option value="BAJA">Baja</option>
        </select>

        {(query || areaId !== "all" || status !== "all") ? (
            <Button variant="ghost" onClick={clearFilters} className="font-bold rounded-xl h-10">
                Limpiar filtros
            </Button>
        ) : <span className="hidden lg:block" />}
    </div>
  );
}
