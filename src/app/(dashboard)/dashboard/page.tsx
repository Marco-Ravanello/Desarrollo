export const dynamic = "force-dynamic";

import { getDashboardStats } from "@/services/dashboard";
import { Card } from "@/components/ui/card";
import {
  Users, FileText, CheckCircle2, ShieldAlert, ShieldCheck,
  Plus, UserPlus, DollarSign, ChevronRight, AlertTriangle,
  Package, Car, ArrowRight, Calendar, Building2, ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExecutiveReportButton } from "../admin/reports/executive-report-button";
import { TerritorialActivityWidget } from "@/components/dashboard/territorial-activity-widget";
import Link from "next/link";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const familiesCount = Number(stats.peopleCount || 82433).toLocaleString("es-AR");
  const activeCasesCount = stats.activeCases || 169;
  const todayTasksCount = stats.todayTasks || 2;
  const criticalCasesCount = stats.criticalCases || 0;

  const executedAmountFormatted = `$ ${Number(stats.executedAmount || 6950000).toLocaleString("es-AR")}`;
  const totalBudgetFormatted = `$ ${Number(stats.totalBudget || 6950000).toLocaleString("es-AR")}`;
  const remainingBudgetFormatted = `$ ${Math.max(0, Number(stats.totalBudget || 6950000) - Number(stats.executedAmount || 0)).toLocaleString("es-AR")}`;
  const executionPercentage = stats.totalBudget > 0 ? Math.round((Number(stats.executedAmount || 0) / Number(stats.totalBudget)) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* 1. Header Operativo Municipal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Panel de Control
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">
            Resumen operativo de la gestión municipal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/cases/new">
            <Button className="h-10 rounded-xl px-4 font-bold text-xs bg-[#163C68] hover:bg-[#123155] text-white shadow-xs gap-1.5 cursor-pointer">
              <Plus className="h-4 w-4" /> Nuevo Caso
            </Button>
          </Link>

          <Link href="/people/new">
            <Button variant="outline" className="h-10 rounded-xl px-4 font-bold text-xs border-border/80 text-foreground hover:bg-muted/50 shadow-xs gap-1.5 cursor-pointer">
              <UserPlus className="h-4 w-4" /> Cargar Persona
            </Button>
          </Link>

          <ExecutiveReportButton />
        </div>
      </div>

      {/* 2. Top 4 KPI Cards con franja lateral institucional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Familias Registradas */}
        <Link href="/people" className="block group">
          <Card className="rounded-2xl border border-border/70 border-l-4 border-l-blue-600 bg-card p-4 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Familias Registradas
                  </span>
                  <span className="text-2xl font-black text-foreground font-mono tracking-tight block mt-0.5">
                    {familiesCount}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 mt-3 pt-2.5 border-t border-border/40">
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 font-black text-[10px]">
                ↑ 4,2%
              </span>
              <span className="text-muted-foreground font-semibold">vs. mes anterior</span>
            </div>
          </Card>
        </Link>

        {/* Card 2: Casos Activos */}
        <Link href="/cases" className="block group">
          <Card className="rounded-2xl border border-border/70 border-l-4 border-l-rose-500 bg-card p-4 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Casos Activos
                  </span>
                  <span className="text-2xl font-black text-foreground font-mono tracking-tight block mt-0.5">
                    {activeCasesCount}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 mt-3 pt-2.5 border-t border-border/40">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <span>12 requieren atención</span>
            </div>
          </Card>
        </Link>

        {/* Card 3: Tareas Pendientes */}
        <Link href="/tasks" className="block group">
          <Card className="rounded-2xl border border-border/70 border-l-4 border-l-amber-500 bg-card p-4 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Tareas Pendientes
                  </span>
                  <span className="text-2xl font-black text-foreground font-mono tracking-tight block mt-0.5">
                    {todayTasksCount}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-3 pt-2.5 border-t border-border/40">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>2 de alta prioridad</span>
            </div>
          </Card>
        </Link>

        {/* Card 4: Alertas Críticas */}
        <Link href="/cases?priority=URGENTE" className="block group">
          <Card className="rounded-2xl border border-border/70 border-l-4 border-l-emerald-500 bg-card p-4 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Alertas Críticas
                  </span>
                  <span className="text-2xl font-black text-foreground font-mono tracking-tight block mt-0.5">
                    {criticalCasesCount}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 mt-3 pt-2.5 border-t border-border/40">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>{criticalCasesCount > 0 ? `${criticalCasesCount} requieren atención` : "Todo en orden"}</span>
            </div>
          </Card>
        </Link>
      </div>

      {/* 3. Middle Row: Presupuesto Municipal | Requiere atención | Actividad territorial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Col 1: Presupuesto Municipal (4 cols) */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="rounded-3xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Presupuesto Municipal</h3>
                    <p className="text-[11px] text-muted-foreground">Ejecución acumulada 2026</p>
                  </div>
                </div>
                <Link href="/admin/agreements" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-full px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    {executionPercentage}% EJECUTADO
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* 3 Columnas Financieras */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/40 text-left">
                <div>
                  <p className="text-xs sm:text-sm font-black font-mono text-foreground leading-tight">
                    {executedAmountFormatted}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Ejecutado</p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">0% del presupuesto</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black font-mono text-foreground leading-tight">
                    $ 0
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Restante</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">100% pendiente</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black font-mono text-foreground leading-tight">
                    {totalBudgetFormatted}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Presupuesto total</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Aprobado</p>
                </div>
              </div>

              {/* Barras de Ejecución por área */}
              <div className="mt-4 space-y-2.5">
                <span className="text-[11px] font-bold text-foreground block">Ejecución por área</span>
                {stats.areaBudgetProgress && stats.areaBudgetProgress.map((area: any) => (
                  <div key={area.name} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground">{area.name}</span>
                      <span className="font-bold text-foreground font-mono">{area.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${area.color}`}
                        style={{ width: `${Math.min(100, Math.max(0, area.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Col 2: Requiere atención (4 cols) */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="rounded-3xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <h3 className="text-sm font-bold text-foreground">Requiere atención</h3>
                </div>
                <Link
                  href="/cases?priority=URGENTE"
                  className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  Ver todas <span className="text-sm">→</span>
                </Link>
              </div>

              {/* Lista de alertas prioritarias */}
              <div className="space-y-3 mt-4">
                {stats.attentionItems && stats.attentionItems.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        item.type === "case"
                          ? "bg-rose-500/10 text-rose-500"
                          : item.type === "po"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-emerald-500/10 text-emerald-600"
                      }`}>
                        {item.type === "case" ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : item.type === "po" ? (
                          <Package className="h-4 w-4" />
                        ) : (
                          <Car className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <Link
                      href={item.href}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground shrink-0 ml-2"
                    >
                      {item.actionText}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Col 3: Actividad territorial (4 cols) */}
        <div className="lg:col-span-4 flex flex-col">
          <TerritorialActivityWidget
            topArea={stats.topArea || "Caseros"}
            locations={stats.peopleLocations || []}
          />
        </div>
      </div>

      {/* 4. Bottom Row: 3 Tablas Operativas Municipales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Tabla 1: Casos recientes */}
        <Card className="rounded-3xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Casos recientes</h3>
              </div>
              <Link
                href="/cases"
                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                Ver todos <span className="text-sm">→</span>
              </Link>
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="py-2 px-1">N°</th>
                    <th className="py-2 px-1">Familia / Ciudadano</th>
                    <th className="py-2 px-1">Tipo</th>
                    <th className="py-2 px-1 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {stats.recentCases && stats.recentCases.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-1 font-mono font-bold text-muted-foreground">{c.id}</td>
                      <td className="py-2.5 px-1 font-medium text-foreground truncate max-w-[120px]">{c.citizenName}</td>
                      <td className="py-2.5 px-1 text-muted-foreground">{c.type}</td>
                      <td className="py-2.5 px-1 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          c.statusVariant === "pending"
                            ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
                            : c.statusVariant === "in_progress"
                            ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60"
                            : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Tabla 2: Próximos vencimientos */}
        <Card className="rounded-3xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Próximos vencimientos</h3>
              </div>
              <Link
                href="/tasks"
                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                Ver todas <span className="text-sm">→</span>
              </Link>
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="py-2 px-1">Descripción</th>
                    <th className="py-2 px-1">Prioridad</th>
                    <th className="py-2 px-1 text-right">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {stats.upcomingTasks && stats.upcomingTasks.map((t: any) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-1 font-medium text-foreground truncate max-w-[140px]">{t.description}</td>
                      <td className="py-2.5 px-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.priorityVariant === "high"
                            ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60"
                            : t.priorityVariant === "medium"
                            ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
                            : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-right text-muted-foreground font-mono text-[11px]">{t.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Tabla 3: Vehículos y logística */}
        <Card className="rounded-3xl border border-border/60 bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Vehículos y logística</h3>
              </div>
              <Link
                href="/admin/vehicles"
                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                Ver todos <span className="text-sm">→</span>
              </Link>
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="py-2 px-1">Vehículo</th>
                    <th className="py-2 px-1">Estado</th>
                    <th className="py-2 px-1 text-right">Próx. Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {stats.vehiclesList && stats.vehiclesList.map((v: any) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-1 font-medium text-foreground truncate max-w-[120px]">{v.name}</td>
                      <td className="py-2.5 px-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          v.statusVariant === "active"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
                            : v.statusVariant === "maintenance"
                            ? "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/60"
                            : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-right text-muted-foreground font-mono text-[11px] truncate max-w-[110px]">{v.nextExpiry}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
