"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Calendar as CalendarIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DashboardDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentRange = searchParams.get("range") || "30days";
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  const [from, setFrom] = useState(currentFrom);
  const [to, setTo] = useState(currentTo);

  const ranges = [
    { value: "today", label: "Hoy" },
    { value: "7days", label: "Últimos 7 días" },
    { value: "30days", label: "Últimos 30 días" },
    { value: "thismonth", label: "Este mes" },
    { value: "year", label: "Este año" },
  ];

  const handleRangeSelect = (range: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    params.delete("from");
    params.delete("to");
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("from", from);
    params.set("to", to);
    router.push(`/dashboard?${params.toString()}`);
  };

  const activeLabel = currentRange === "custom"
    ? `${from} a ${to}`
    : ranges.find(r => r.value === currentRange)?.label || "Filtrar Fechas";

  return (
    <div className="flex items-center gap-2">
      {/* Range Buttons */}
      <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-card border border-border/40 shadow-sm">
        {ranges.map((r) => (
          <Button
            key={r.value}
            variant={currentRange === r.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleRangeSelect(r.value)}
            className={`rounded-xl text-xs font-semibold uppercase tracking-wider px-3.5 py-1.5 h-auto transition-all ${
              currentRange === r.value
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Popover for Mobile & Custom Range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl flex items-center gap-2 border border-border/40 bg-card hover:bg-muted text-foreground text-xs font-bold uppercase tracking-wider shadow-sm transition-all">
            <CalendarIcon className="h-4 w-4 text-blue-500" />
            <span>{activeLabel}</span>
            <Filter className="h-3 w-3 text-muted-foreground ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border/40 shadow-municipal-lg text-foreground">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rango Rápido</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {ranges.map((r) => (
                  <Button
                    key={r.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRangeSelect(r.value)}
                    className={`rounded-xl text-left justify-start text-[11px] font-semibold uppercase tracking-wider px-3 py-2 h-auto transition-all ${
                      currentRange === r.value
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>

            <hr className="border-border/40" />

            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rango Personalizado</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="from" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Desde</Label>
                  <Input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-8 text-xs rounded-lg border-border/45 bg-muted/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hasta</Label>
                  <Input
                    id="to"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-8 text-xs rounded-lg border-border/45 bg-muted/50"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" className="w-full h-8 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all">
                Aplicar Rango
              </Button>
            </form>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
