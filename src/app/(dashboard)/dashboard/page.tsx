export const dynamic = "force-dynamic";

import { getDashboardStats } from "@/services/dashboard";
import { getTasks } from "@/services/system";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import {
  Users, FileText, CheckCircle2, ShieldCheck,
  Plus, UserPlus, ChevronRight, AlertTriangle,
  Car, Calendar, ArrowUpRight, LayoutDashboard, Wallet
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Button } from "@/components/ui/button";
import { ExecutiveReportButton } from "../admin/reports/executive-report-button";
import { TerritorialActivityWidget } from "@/components/dashboard/territorial-activity-widget";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const [stats, myTasks] = await Promise.all([
    getDashboardStats(),
    session?.user?.id ? getTasks(session.user.id).catch(() => []) : Promise.resolve([]),
  ]);

  const familiesCount = Number(stats.peopleCount || 0).toLocaleString("es-AR");
  const activeCasesCount = stats.activeCases || 0;
  const criticalCasesCount = stats.criticalCases || 0;

  // Mismas tareas que muestra "Mis Tareas": las del usuario que no están completadas.
  const pendingTasks = myTasks.filter((t) => t.status !== "COMPLETADA");
  const highPriorityTasksCount = pendingTasks.filter((t) => t.priority === "ALTA" || t.priority === "URGENTE").length;
  const upcomingTasks = pendingTasks.slice(0, 5).map((t) => ({
    id: t.id,
    description: t.title,
    priority: t.priority || "MEDIA",
    priorityVariant: t.priority === "URGENTE" || t.priority === "ALTA" ? "high" : t.priority === "MEDIA" ? "medium" : "low",
    dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "S/D",
  }));

  const totalBudget = Number(stats.totalBudget || 0);
  const executedAmount = Number(stats.executedAmount || 0);
  const hasBudget = totalBudget > 0;
  const executedAmountFormatted = `$ ${executedAmount.toLocaleString("es-AR")}`;
  const totalBudgetFormatted = `$ ${totalBudget.toLocaleString("es-AR")}`;
  const remainingBudgetFormatted = `$ ${Math.max(0, totalBudget - executedAmount).toLocaleString("es-AR")}`;
  const executionPercentage = hasBudget ? Math.round((executedAmount / totalBudget) * 100) : 0;

  const firstName = (session?.user?.name || "").trim().split(/\s+/)[0];
  const now = new Date();
  const hour = Number(now.toLocaleString("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }));
  const greeting = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const todayLabel = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      <PageHeader
        icon={LayoutDashboard}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description={<span className="first-letter:uppercase inline-block">{todayLabel} · Resumen de la gestión</span>}
        actions={
          <>
            <Button asChild size="sm" className="h-9 rounded-xl gap-1.5">
              <Link href="/cases/new"><Plus className="h-4 w-4" /> Nuevo caso</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl gap-1.5">
              <Link href="/people/new"><UserPlus className="h-4 w-4" /> Cargar persona</Link>
            </Button>
            <ExecutiveReportButton />
          </>
        }
      />

      {/* Indicadores principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link href="/people" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            className="h-full transition-colors hover:border-primary/40"
            label="Personas registradas"
            value={familiesCount}
            icon={Users}
            tone="blue"
            hint="En el padrón unificado"
          />
        </Link>
        <Link href="/cases" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            className="h-full transition-colors hover:border-primary/40"
            label="Casos activos"
            value={activeCasesCount}
            icon={FileText}
            tone="red"
            hint={criticalCasesCount > 0
              ? <span className="text-rose-600 dark:text-rose-400 font-medium">{criticalCasesCount} con prioridad urgente</span>
              : "Ninguno urgente"}
          />
        </Link>
        <Link href="/tasks" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            className="h-full transition-colors hover:border-primary/40"
            label="Mis tareas pendientes"
            value={pendingTasks.length}
            icon={CheckCircle2}
            tone="orange"
            hint={highPriorityTasksCount > 0
              ? <span className="text-orange-600 dark:text-orange-400 font-medium">{highPriorityTasksCount} de alta prioridad</span>
              : "Ninguna de alta prioridad"}
          />
        </Link>
        <Link href="/cases?priority=URGENTE" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <StatCard
            className="h-full transition-colors hover:border-primary/40"
            label="Alertas críticas"
            value={criticalCasesCount}
            icon={criticalCasesCount > 0 ? AlertTriangle : ShieldCheck}
            tone={criticalCasesCount > 0 ? "red" : "green"}
            hint={criticalCasesCount > 0
              ? <span className="text-rose-600 dark:text-rose-400 font-medium">Requieren atención</span>
              : <span className="text-emerald-600 dark:text-emerald-400 font-medium">Todo en orden</span>}
          />
        </Link>
      </div>

      {/* Requiere atención | Presupuesto | Actividad territorial */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Col 2: Requiere atención */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col justify-between h-full">
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
                {(!stats.attentionItems || stats.attentionItems.length === 0) && (
                  <EmptyMessage
                    icon={ShieldCheck}
                    title="Nada urgente por ahora"
                    description="No hay casos urgentes ni órdenes de compra esperando firma."
                    className="py-8"
                  />
                )}
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

        {/* Col 1: Presupuesto Municipal */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-foreground">Presupuesto</h3>
                </div>
                <Link href="/admin/budget" className="flex items-center gap-1 shrink-0">
                  <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap ${hasBudget ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {hasBudget ? `${executionPercentage}% ejecutado` : "Sin cargar"}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              </div>

              {/* 3 Métricas Financieras */}
              <div className="grid grid-cols-3 gap-2 py-3.5 text-left border-b border-border/30">
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {executedAmountFormatted}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Ejecutado</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {remainingBudgetFormatted}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Restante</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {totalBudgetFormatted}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Total</p>
                </div>
              </div>

              {!hasBudget && (
                <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                  Todavía no se cargó el presupuesto anual de las áreas, por eso no se puede calcular el porcentaje ejecutado.{" "}
                  <Link href="/admin/budget" className="font-medium text-primary hover:underline">Cargar presupuesto</Link>
                </p>
              )}

              {/* Barras de Ejecución ultra-delgadas */}
              {hasBudget && (
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
              )}
            </div>
          </Card>
        </div>

        {/* Col 3: Actividad territorial */}
        <div className="md:col-span-2 lg:col-span-4 flex flex-col">
          <TerritorialActivityWidget
            topArea={stats.topArea}
            locations={stats.peopleLocations || []}
          />
        </div>
      </div>

      {/* 4. Bottom Row: 3 Tablas Operativas Limpias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Tabla 1: Casos recientes */}
        <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col justify-between">
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
                  {(!stats.recentCases || stats.recentCases.length === 0) && (
                    <tr><td colSpan={4} className="py-6 text-center text-[11px] text-muted-foreground">Todavía no hay casos cargados.</td></tr>
                  )}
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
        <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col justify-between">
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
                  {upcomingTasks.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-[11px] text-muted-foreground">No tenés tareas pendientes.</td></tr>
                  )}
                  {upcomingTasks.map((t: any) => (
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
        <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col justify-between">
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
                  {(!stats.vehiclesList || stats.vehiclesList.length === 0) && (
                    <tr><td colSpan={3} className="py-6 text-center text-[11px] text-muted-foreground">No hay vehículos cargados en la flota.</td></tr>
                  )}
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
