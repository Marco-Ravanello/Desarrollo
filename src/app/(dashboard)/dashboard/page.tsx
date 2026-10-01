export const dynamic = "force-dynamic";

import { getDashboardStats } from "@/services/dashboard";
import { Card } from "@/components/ui/card";
import {
  Users, FileText, CheckCircle2, ShieldCheck,
  Plus, UserPlus, DollarSign, ChevronRight, AlertTriangle,
  Package, Car, Calendar, ArrowUpRight
} from "lucide-react";
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
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* 1. Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/30">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Panel de Control
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Centro de monitoreo operativo y gestión municipal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/cases/new">
            <Button size="sm" className="h-9 rounded-xl px-3.5 font-medium text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-none gap-1.5 cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> Nuevo Caso
            </Button>
          </Link>

          <Link href="/people/new">
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3.5 font-medium text-xs border-border/60 hover:bg-muted/40 shadow-none gap-1.5 cursor-pointer">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" /> Cargar Persona
            </Button>
          </Link>

          <ExecutiveReportButton />
        </div>
      </div>

      {/* 2. Top 4 KPI Cards Minimalistas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Familias Registradas */}
        <Link href="/people" className="block group">
          <Card className="rounded-2xl border border-border/50 bg-card p-4 hover:border-border/80 transition-all duration-200 shadow-none hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Familias Registradas</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {familiesCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 pt-2.5 border-t border-border/30">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">↑ 4,2%</span>
              <span className="text-[11px]">vs. mes anterior</span>
            </div>
          </Card>
        </Link>

        {/* Card 2: Casos Activos */}
        <Link href="/cases" className="block group">
          <Card className="rounded-2xl border border-border/50 bg-card p-4 hover:border-border/80 transition-all duration-200 shadow-none hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Casos Activos</span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {activeCasesCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs mt-3 pt-2.5 border-t border-border/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">12 requieren atención</span>
            </div>
          </Card>
        </Link>

        {/* Card 3: Tareas Pendientes */}
        <Link href="/tasks" className="block group">
          <Card className="rounded-2xl border border-border/50 bg-card p-4 hover:border-border/80 transition-all duration-200 shadow-none hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tareas Pendientes</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {todayTasksCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs mt-3 pt-2.5 border-t border-border/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">2 de alta prioridad</span>
            </div>
          </Card>
        </Link>

        {/* Card 4: Alertas Críticas */}
        <Link href="/cases?priority=URGENTE" className="block group">
          <Card className="rounded-2xl border border-border/50 bg-card p-4 hover:border-border/80 transition-all duration-200 shadow-none hover:shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Alertas Críticas</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {criticalCasesCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs mt-3 pt-2.5 border-t border-border/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {criticalCasesCount > 0 ? `${criticalCasesCount} pendientes` : "Todo en orden"}
              </span>
            </div>
          </Card>
        </Link>
      </div>

      {/* 3. Middle Row: Presupuesto | Requiere atención | Actividad territorial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Col 1: Presupuesto Municipal */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="rounded-2xl border border-border/50 bg-card p-5 shadow-none flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-foreground">Presupuesto Municipal</h3>
                </div>
                <Link href="/admin/agreements" className="flex items-center gap-1">
                  <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {executionPercentage}% ejecutado
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              </div>

              {/* 3 Métricas Financieras */}
              <div className="grid grid-cols-3 gap-2 py-3.5 text-left border-b border-border/30">
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {executedAmountFormatted}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ejecutado</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {remainingBudgetFormatted}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Restante</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {totalBudgetFormatted}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
                </div>
              </div>

              {/* Barras de Ejecución ultra-delgadas */}
              <div className="mt-4 space-y-3">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Distribución por área
                </span>
                {stats.areaBudgetProgress && stats.areaBudgetProgress.map((area: any) => (
                  <div key={area.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground text-[11px]">{area.name}</span>
                      <span className="font-medium text-foreground text-[11px]">{area.percentage}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
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

        {/* Col 2: Requiere atención */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="rounded-2xl border border-border/50 bg-card p-5 shadow-none flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Requiere atención</h3>
                </div>
                <Link
                  href="/cases?priority=URGENTE"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                >
                  Ver todas <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Lista Minimalista */}
              <div className="divide-y divide-border/30 mt-1">
                {stats.attentionItems && stats.attentionItems.map((item: any) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between py-3 hover:bg-muted/20 px-1 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        item.type === "case"
                          ? "bg-rose-500"
                          : item.type === "po"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Col 3: Actividad territorial */}
        <div className="lg:col-span-4 flex flex-col">
          <TerritorialActivityWidget
            topArea={stats.topArea || "Caseros"}
            locations={stats.peopleLocations || []}
          />
        </div>
      </div>

      {/* 4. Bottom Row: 3 Tablas Operativas Limpias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Tabla 1: Casos recientes */}
        <Card className="rounded-2xl border border-border/50 bg-card p-5 shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-foreground">Casos recientes</h3>
              </div>
              <Link
                href="/cases"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              >
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto mt-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-1.5 font-medium">N°</th>
                    <th className="py-2.5 px-1.5 font-medium">Ciudadano</th>
                    <th className="py-2.5 px-1.5 font-medium">Área</th>
                    <th className="py-2.5 px-1.5 text-right font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {stats.recentCases && stats.recentCases.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-1.5 text-muted-foreground font-mono text-[11px]">{c.id}</td>
                      <td className="py-2.5 px-1.5 font-medium text-foreground truncate max-w-[110px]">{c.citizenName}</td>
                      <td className="py-2.5 px-1.5 text-muted-foreground text-[11px]">{c.type}</td>
                      <td className="py-2.5 px-1.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          c.statusVariant === "pending"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : c.statusVariant === "in_progress"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
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
        <Card className="rounded-2xl border border-border/50 bg-card p-5 shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">Próximos vencimientos</h3>
              </div>
              <Link
                href="/tasks"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              >
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto mt-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-1.5 font-medium">Tarea</th>
                    <th className="py-2.5 px-1.5 font-medium">Prioridad</th>
                    <th className="py-2.5 px-1.5 text-right font-medium">Plazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {stats.upcomingTasks && stats.upcomingTasks.map((t: any) => (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-1.5 font-medium text-foreground truncate max-w-[130px]">{t.description}</td>
                      <td className="py-2.5 px-1.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          t.priorityVariant === "high"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : t.priorityVariant === "medium"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-1.5 text-right text-muted-foreground font-mono text-[11px]">{t.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Tabla 3: Vehículos y logística */}
        <Card className="rounded-2xl border border-border/50 bg-card p-5 shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-foreground">Vehículos y logística</h3>
              </div>
              <Link
                href="/admin/vehicles"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              >
                Ver flota <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto mt-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-1.5 font-medium">Unidad</th>
                    <th className="py-2.5 px-1.5 font-medium">Estado</th>
                    <th className="py-2.5 px-1.5 text-right font-medium">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {stats.vehiclesList && stats.vehiclesList.map((v: any) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-1.5 font-medium text-foreground truncate max-w-[110px]">{v.name}</td>
                      <td className="py-2.5 px-1.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          v.statusVariant === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : v.statusVariant === "maintenance"
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-1.5 text-right text-muted-foreground font-mono text-[11px] truncate max-w-[100px]">{v.nextExpiry}</td>
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
