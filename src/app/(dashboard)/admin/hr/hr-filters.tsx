"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useDebounce } from "@/lib/hooks"; // Assuming this exists or we can implement inline

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
    <div className="p-6 border-b border-border/50 flex flex-col md:flex-row gap-4 items-center justify-between">
      <form onSubmit={handleSearch} className="relative w-full max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, DNI o legajo..."
          className="pl-11 h-12 rounded-2xl bg-muted/50 border-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
            <button type="button" onClick={() => {setQuery(""); updateFilters({q: ""})}} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full">
                <X className="h-3 w-3" />
            </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <select
          className="h-12 px-4 rounded-xl bg-muted/50 border-none font-bold text-sm text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
          value={areaId}
          onChange={(e) => {
            setAreaId(e.target.value);
            updateFilters({ area: e.target.value });
          }}
        >
          <option value="all">Todas las Áreas</option>
          {areas.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          className="h-12 px-4 rounded-xl bg-muted/50 border-none font-bold text-sm text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            updateFilters({ status: e.target.value });
          }}
        >
          <option value="all">Todos los Estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="LICENCIA">Licencia</option>
          <option value="VACACIONES">Vacaciones</option>
          <option value="BAJA">Baja</option>
        </select>

        {(query || areaId !== "all" || status !== "all") && (
            <Button variant="ghost" onClick={clearFilters} className="text-rose-500 font-bold hover:text-rose-600 hover:bg-rose-50 rounded-xl">
                Limpiar
            </Button>
        )}
      </div>
    </div>
  );
}
