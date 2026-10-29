"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileFilters } from "@/components/ui/mobile-filters";
import { FilterForm } from "@/components/ui/filter-form";
import { ActiveFilters } from "@/components/ui/active-filters";

interface PeopleFiltersProps {
  barrios: string[];
  programas: string[];
}

const selectClass =
  "h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** Filtros del Registro Único: el barrio y el programa se aplican al elegirlos; el texto, con Enter o Buscar. */
export function PeopleFilters({ barrios, programas }: PeopleFiltersProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const barrio = searchParams.get("barrio") || "";
  const programa = searchParams.get("programa") || "";
  const limit = searchParams.get("limit") || "";
  const falta = searchParams.get("falta") || "";

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-sm">
      <FilterForm className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-12">
        {limit && <input type="hidden" name="limit" value={limit} />}
        {falta && <input type="hidden" name="falta" value={falta} />}
        <div className="relative sm:col-span-2 lg:col-span-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            defaultValue={search}
            aria-label="Buscar personas"
            placeholder="Buscar por DNI, apellido, nombre o dirección"
            className="h-10 rounded-xl border-border/60 bg-muted/30 pl-9 text-xs"
          />
        </div>
        <MobileFilters active={[barrio, programa].filter(Boolean).length}>
          <div className="lg:col-span-3">
            <select name="barrio" aria-label="Barrio o localidad" defaultValue={barrio || "all"} className={selectClass}>
              <option value="all">Todos los barrios y localidades</option>
              {barrios.map((b) => (
                <option key={`b-${b}`} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <select name="programa" aria-label="Programa" defaultValue={programa || "all"} className={selectClass}>
              <option value="all">Todos los programas</option>
              {programas.map((p) => (
                <option key={`p-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </MobileFilters>
        <Button type="submit" size="sm" className="h-10 rounded-xl text-xs font-bold sm:col-span-2 lg:col-span-1">
          Buscar
        </Button>
      </FilterForm>
      <ActiveFilters
        clearHref={falta ? `/people?falta=${falta}` : "/people"}
        items={[search && `Texto: ${search}`, barrio && `Barrio: ${barrio}`, programa && `Programa: ${programa}`]}
      />
    </Card>
  );
}
