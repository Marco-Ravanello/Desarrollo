"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Pie,
  PieChart
} from "recharts";
import { useTheme } from "next-themes";
import {
  Layers,
  ShieldCheck,
  HeartHandshake,
  Home,
  Building,
  TrendingUp,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  BarChart3,
  ListOrdered,
  Car,
  Zap,
  Activity,
  ShoppingBag,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

const COLORS = ['#004a80', '#10b981', '#f5a623', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

interface DashboardChartsProps {
  casesByAreaData: any[];
  poStatusData: any[];
  trendData: any[];
  areas?: any[];
  executedAmount?: number;
  resolvedCasesCount?: number;
  activeCases?: number;
  vehicleStats?: { total: number; occupied: number; available: number };
  pendingDerivations?: number;
}

export function DashboardCharts({
  casesByAreaData = [],
  poStatusData = [],
  trendData = [],
  areas = [],
  executedAmount = 0,
  resolvedCasesCount = 0,
  activeCases = 0,
  vehicleStats = { total: 0, occupied: 0, available: 0 },
  pendingDerivations = 0
}: DashboardChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"bars" | "ranking">("ranking");

  const areaTabs = [
    { id: "all", label: "Todas las Áreas", icon: Layers },
    ...(areas.length > 0
      ? areas.map((a) => ({
          id: a.id,
          label: a.name.replace("Dirección de ", "").replace("Coordinación de ", "").replace("Secretaría de ", "").trim(),
          icon: a.name.toLowerCase().includes("hábitat") ? Home : a.name.toLowerCase().includes("niñez") ? HeartHandshake : ShieldCheck
        }))
      : casesByAreaData.map((c) => ({
          id: c.name,
          label: c.name.replace("Dirección de ", "").replace("Coordinación de ", "").trim(),
          icon: Building
        })))
  ];

  const filteredCasesData = casesByAreaData.filter((item) => {
    if (selectedArea === "all") return true;
    const targetArea = areas.find((a) => a.id === selectedArea);
    if (targetArea) {
      return item.name === targetArea.name;
    }
    return item.name === selectedArea;
  });

  const totalCasesInSelection = filteredCasesData.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const sortedCasesRanking = [...filteredCasesData].sort((a, b) => b.value - a.value);

  const totalIngresadosSemestre = trendData.reduce((acc, curr) => acc + (curr.ingresados || curr.casos || 0), 0);
  const totalResueltosSemestre = trendData.reduce((acc, curr) => acc + (curr.resueltos || 0), 0);

  const totalCasesCombined = (activeCases || 0) + (resolvedCasesCount || 0);
  const resolutionRatePercent = totalCasesCombined > 0
    ? Math.round((resolvedCasesCount / totalCasesCombined) * 100)
    : 78;

  const totalOrdersCount = poStatusData.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const formattedExecutedAmount = (executedAmount / 1000000).toFixed(2);

  const getAreaIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("hábitat") || lower.includes("vivienda")) return Home;
    if (lower.includes("niñez") || lower.includes("familia")) return HeartHandshake;
    if (lower.includes("violencia") || lower.includes("género")) return ShieldCheck;
    if (lower.includes("desarrollo") || lower.includes("social")) return Building;
    return Layers;
  };

  return (
    <div className="space-y-6">
      {/* Area Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-card/60 backdrop-blur-md border border-white/[0.06] shadow-sm">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3">
          Filtrar por Área:
        </span>
        {areaTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedArea === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedArea(tab.id)}
              className={`h-8 text-xs font-semibold rounded-xl transition-all duration-200 gap-1.5 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. Semestral AreaChart with SVG Gradient */}
        <div className="bg-card/60 backdrop-blur-md p-6 rounded-3xl border border-white/[0.06] shadow-xl col-span-full lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                  Evolución Semestral de Casos
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Comparativa entre casos ingresados y soluciones concretadas.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-border/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-[11px] font-bold text-foreground">
                  {totalIngresadosSemestre} Ingresados
                </span>
              </div>
              <div className="flex items-center gap-2 border-l border-border/40 pl-4">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-bold text-emerald-400">
                  {totalResueltosSemestre} Resueltos
                </span>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientIngresados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004a80" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#004a80" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradientResueltos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
                  dy={10}
                />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '16px',
                    border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ingresados"
                  name="Ingresados"
                  stroke="#004a80"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradientIngresados)"
                />
                <Area
                  type="monotone"
                  dataKey="resueltos"
                  name="Resueltos"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradientResueltos)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Lateral Widget: Operational Efficiency */}
        <div className="bg-card/60 backdrop-blur-md p-6 rounded-3xl border border-white/[0.06] shadow-xl space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Zap className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                Eficiencia Operativa
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Desempeño general de respuesta municipal.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Tasa de Resolución
                </span>
                <span className="text-emerald-400 font-mono text-sm font-black">{resolutionRatePercent}%</span>
              </div>
              <Progress value={resolutionRatePercent} className="h-2.5 rounded-full bg-muted" />
              <p className="text-[10px] text-muted-foreground">
                {resolvedCasesCount} casos cerrados de {totalCasesCombined} tramitados.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-foreground flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 text-blue-500" /> Disponibilidad de Flota
                </span>
                <span className="text-blue-400 font-mono text-sm font-black">
                  {vehicleStats.total > 0 ? Math.round((vehicleStats.available / vehicleStats.total) * 100) : 100}%
                </span>
              </div>
              <Progress
                value={vehicleStats.total > 0 ? (vehicleStats.available / vehicleStats.total) * 100 : 100}
                className="h-2.5 rounded-full bg-muted"
              />
              <p className="text-[10px] text-muted-foreground">
                {vehicleStats.available} de {vehicleStats.total} vehículos listos para patrullaje/logística.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-400" />
                <div>
                  <p className="text-xs font-bold text-foreground">Derivaciones Interáreas</p>
                  <p className="text-[10px] text-muted-foreground">Pendientes de respuesta</p>
                </div>
              </div>
              <Badge className="bg-sky-500/20 text-sky-400 border-none font-black text-xs font-mono">
                {pendingDerivations}
              </Badge>
            </div>
          </div>
        </div>

        {/* 3. Horizontal Cases by Area ranking with progress bars & toggle */}
        <div className="bg-card/60 backdrop-blur-md p-6 rounded-3xl border border-white/[0.06] shadow-xl col-span-full lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                Distribución de Casos por Área Operativa
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Volumen de demanda territorial en secretarías.
              </p>
            </div>

            <div className="flex items-center bg-muted/40 p-1 rounded-2xl border border-border/40">
              <Button
                variant={viewMode === "ranking" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("ranking")}
                className="h-7 text-xs font-bold rounded-xl gap-1.5"
              >
                <ListOrdered className="h-3.5 w-3.5" /> Ranking Horizontal
              </Button>
              <Button
                variant={viewMode === "bars" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("bars")}
                className="h-7 text-xs font-bold rounded-xl gap-1.5"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Gráfico
              </Button>
            </div>
          </div>

          {viewMode === "ranking" ? (
            <div className="space-y-3.5">
              {sortedCasesRanking.map((item, idx) => {
                const AreaIcon = getAreaIcon(item.name);
                const percentage = totalCasesInSelection > 0 ? Math.round((item.value / totalCasesInSelection) * 100) : 0;
                const barColor = COLORS[idx % COLORS.length];

                return (
                  <div key={item.name} className="p-3.5 rounded-2xl bg-muted/20 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black font-mono text-muted-foreground w-4">
                          #{idx + 1}
                        </span>
                        <div className="p-2 rounded-xl bg-muted text-primary border border-border/40">
                          <AreaIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{percentage}% de la demanda global</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black font-mono text-foreground">{item.value}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">casos</span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 4)}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredCasesData.length > 0 ? filteredCasesData : casesByAreaData}>
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderRadius: '12px',
                      border: isDark ? '1px solid #1e293b' : 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={36}>
                    {(filteredCasesData.length > 0 ? filteredCasesData : casesByAreaData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 4. Redesigned Purchase Orders Donut with central metric and link */}
        <div className="bg-card/60 backdrop-blur-md p-6 rounded-3xl border border-white/[0.06] shadow-xl space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                  Órdenes de Compra
                </h3>
              </div>
              <Link href="/admin/purchase-orders">
                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-primary gap-1 uppercase">
                  Ver OC <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estado de compras y contrataciones municipales.
            </p>
          </div>

          <div className="relative h-[180px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={poStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                >
                  {poStatusData.map((entry, index) => (
                    <Cell key={`po-cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '12px',
                    border: isDark ? '1px solid #1e293b' : 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Metric Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-xl font-black font-mono text-foreground tracking-tight">
                ${formattedExecutedAmount}M
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {totalOrdersCount} Órdenes
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/30">
            {poStatusData.map((status, idx) => (
              <div key={status.name || idx} className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-muted/20">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: status.fill || COLORS[idx % COLORS.length] }}
                  />
                  <span className="font-semibold text-foreground text-[11px] truncate">{status.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground">{status.value}</span>
                  {status.amount ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      (${ (status.amount / 1000).toFixed(0) }k)
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
