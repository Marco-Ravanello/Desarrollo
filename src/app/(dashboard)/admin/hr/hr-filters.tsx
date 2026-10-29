"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterForm } from "@/components/ui/filter-form";
import { MobileFilters } from "@/components/ui/mobile-filters";
import { ActiveFilters } from "@/components/ui/active-filters";
import { hrStatusLabel } from "@/lib/hr-labels";

const selectClass =
  "h-10 w-full min-w-0 truncate rounded-xl border border-border/60 bg-muted/30 px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

const STATUSES = ["ACTIVO", "LICENCIA", "VACACIONES", "BAJA"];

export function HRFilters({ areas }: { areas: { id: string; name: string }[] }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const area = searchParams.get("area") || "";
  const status = searchParams.get("status") || "";

  return (
    <div className="border-b border-border/50 p-4 sm:p-5">
      <FilterForm className="grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_16rem_12rem_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            aria-label="Buscar personal"
            placeholder="Buscar por nombre, DNI o legajo"
            className="h-10 rounded-xl border-border/60 bg-muted/30 pl-9 text-xs"
          />
        </div>
        <MobileFilters active={[area, status].filter(Boolean).length}>
          <select name="area" aria-label="Área" defaultValue={area || "all"} className={selectClass}>
            <option value="all">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="status" aria-label="Situación" defaultValue={status || "all"} className={selectClass}>
            <option value="all">Todas las situaciones</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {hrStatusLabel(s)}
              </option>
            ))}
          </select>
        </MobileFilters>
        <Button type="submit" size="sm" className="h-10 rounded-xl text-xs font-bold">
          Buscar
        </Button>
      </FilterForm>
      <ActiveFilters
        clearHref="/admin/hr"
        items={[
          q && `Texto: ${q}`,
          area && `Área: ${areas.find((a) => a.id === area)?.name ?? area}`,
          status && `Situación: ${hrStatusLabel(status)}`,
        ]}
      />
    </div>
  );
}
