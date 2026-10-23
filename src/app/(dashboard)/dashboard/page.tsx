export const dynamic = "force-dynamic";

import { getDashboardStats, type DashboardStats } from "@/services/dashboard";
import { getTasks } from "@/services/system";
import { countDerivationsToAnswer } from "@/services/derivations";
import { getMyAssignedCases, type MyAssignedCase } from "@/services/cases";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import {
  Users, FileText, CheckCircle2, ShieldCheck,
  Plus, UserPlus, ChevronRight, AlertTriangle,
  Car, Calendar, ArrowUpRight, LayoutDashboard, Wallet, FileSignature, Archive, ArrowRightLeft, FolderOpen,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, type StatTone } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Button } from "@/components/ui/button";
import { ExecutiveReportButton } from "../admin/reports/executive-report-button";
import { TerritorialActivityWidget } from "@/components/dashboard/territorial-activity-widget";
import Link from "next/link";
import { formatVencimiento } from "@/lib/fechas";

/**
 * Cada rol ve primero lo suyo:
 * - direccion: indicadores de toda la gestión (Superadmin, Dirección General, Administración General).
 * - area: dirección de un área, con los casos y el presupuesto de esa área.
 * - operativo: equipos de territorio (Operativo, Violencia de Género), con sus tareas y los casos de su área.
 * - auditor: indicadores de solo lectura, sin accesos para cargar datos.
 */
type Profile = "direccion" | "area" | "operativo" | "auditor";

function profileFor(role: Role): Profile {
  switch (role) {
    case "SUPERADMIN":
    case "DIRECCION_GENERAL":
    case "ADMIN_GENERAL":
      return "direccion";
    case "DIRECTOR_AREA":
      return "area";
    case "AUDITOR":
      return "auditor";
    default:
      return "operativo";
  }
}

type KpiId = "people" | "activeCases" | "urgentCases" | "closedCases" | "pendingOrders" | "myTasks";
type SectionId = "myCases" | "attention" | "budget" | "territorial" | "recentCases" | "tasks" | "vehicles";

const LAYOUT: Record<Profile, { kpis: KpiId[]; sections: SectionId[] }> = {
  direccion: {
    kpis: ["people", "activeCases", "urgentCases", "pendingOrders"],
    sections: ["attention", "budget", "territorial", "recentCases", "tasks", "vehicles"],
  },
  area: {
    kpis: ["activeCases", "urgentCases", "closedCases", "myTasks"],
    sections: ["attention", "recentCases", "budget", "tasks"],
  },
  operativo: {
    kpis: ["myTasks", "activeCases", "urgentCases", "people"],
    sections: ["tasks", "attention", "recentCases"],
  },
  auditor: {
    kpis: ["people", "activeCases", "urgentCases", "pendingOrders"],
    sections: ["budget", "recentCases", "attention"],
  },
};

export const metadata = { title: "Inicio" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ "sin-permiso"?: string }>;
}) {
  const deniedAccess = (await searchParams)["sin-permiso"] === "1";
  const session = await auth();
  const role = (session?.user?.role || "OPERATIVO") as Role;
  const profile = profileFor(role);
  const canViewSensitive = hasPermission(role, PERMISSIONS.VIEW_SENSITIVE_CASES);
  // Dirección y auditoría miran toda la gestión; el resto, su área (si tiene una asignada).
  const areaId = profile === "direccion" || profile === "auditor" ? null : session?.user?.areaId || null;

  const [stats, myTasks, area, derivationsToAnswer, myCases] = await Promise.all([
    getDashboardStats({ areaId, canViewSensitive }),
    session?.user?.id ? getTasks(session.user.id).catch(() => []) : Promise.resolve([]),
    areaId ? prisma.area.findUnique({ where: { id: areaId }, select: { name: true } }).catch(() => null) : null,
    session?.user ? countDerivationsToAnswer(session.user).catch(() => 0) : 0,
    session?.user?.id ? getMyAssignedCases(session.user.id).catch(() => ({ total: 0, cases: [] })) : { total: 0, cases: [] },
  ]);

  // Mismas tareas que muestra "Mis Tareas": las del usuario que no están completadas.
  const pendingTasks = myTasks.filter((t) => t.status !== "COMPLETADA");
  const highPriorityTasksCount = pendingTasks.filter((t) => t.priority === "ALTA" || t.priority === "URGENTE").length;

  const casesQuery = (extra: Record<string, string>) =>
    `/cases?${new URLSearchParams({ ...(areaId ? { area: areaId } : {}), ...extra })}`;

  const kpis: Record<KpiId, { href: string; label: string; value: string | number; icon: any; tone: StatTone; hint: React.ReactNode }> = {
    people: {
      href: "/people",
      label: "Personas registradas",
      value: Number(stats.peopleCount || 0).toLocaleString("es-AR"),
      icon: Users,
      tone: "blue",
      hint: "En el padrón unificado",
    },
    activeCases: {
      href: casesQuery({ status: "ACTIVOS" }),
      label: area ? "Expedientes abiertos del área" : "Expedientes abiertos",
      value: stats.activeCases,
      icon: FileText,
      tone: "blue",
      hint: "Abiertos o en proceso",
    },
    urgentCases: {
      href: casesQuery({ status: "ACTIVOS", priority: "URGENTE" }),
      label: "Expedientes urgentes",
      value: stats.criticalCases,
      icon: stats.criticalCases > 0 ? AlertTriangle : ShieldCheck,
      tone: stats.criticalCases > 0 ? "red" : "green",
      hint: stats.criticalCases > 0
        ? <span className="text-rose-600 dark:text-rose-400 font-medium">Requieren atención</span>
        : <span className="text-emerald-700 dark:text-emerald-400 font-medium">Todo en orden</span>,
    },
    closedCases: {
      href: casesQuery({ status: "CERRADO" }),
      label: "Expedientes cerrados",
      value: stats.closedCases,
      icon: Archive,
      tone: "slate",
      hint: "Cerrados en total",
    },
    pendingOrders: {
      href: "/admin/purchase-orders?status=PENDIENTE_APROBACION",
      label: "Órdenes por firmar",
      value: stats.pendingPurchaseOrders,
      icon: FileSignature,
      tone: stats.pendingPurchaseOrders > 0 ? "orange" : "green",
      hint: stats.pendingPurchaseOrders > 0 ? "Esperan aprobación" : "Ninguna pendiente",
    },
    myTasks: {
      href: "/tasks",
      label: "Mis tareas pendientes",
      value: pendingTasks.length,
      icon: CheckCircle2,
      tone: "orange",
      hint: highPriorityTasksCount > 0
        ? <span className="text-orange-700 dark:text-orange-400 font-medium">{highPriorityTasksCount} de alta prioridad</span>
        : "Ninguna de alta prioridad",
    },
  };

  const layout = LAYOUT[profile];
  // "Mis expedientes a cargo" aparece primero, solo para quien tiene expedientes asignados.
  // El Superadmin la ve siempre (se usa para probar todo), aunque no tenga expedientes a cargo.
  const showMyCases = myCases.total > 0 || role === "SUPERADMIN";
  const sections: SectionId[] = showMyCases ? ["myCases", ...layout.sections] : layout.sections;
  const canLoadData = profile !== "auditor";
  const canSeeReports = hasPermission(role, PERMISSIONS.VIEW_REPORTS);

  const firstName = (session?.user?.name || "").trim().split(/\s+/)[0];
  const now = new Date();
  const hour = Number(now.toLocaleString("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }));
  const greeting = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const todayLabel = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });
  const scopeLabel = area ? `Resumen de ${area.name}` : "Resumen de la gestión";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      <PageHeader
        icon={LayoutDashboard}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description={<span className="first-letter:uppercase inline-block">{todayLabel} · {scopeLabel}</span>}
        actions={
          <>
            {canLoadData && (
              <>
                <Button asChild size="sm" className="h-9 rounded-xl gap-1.5">
                  <Link href="/cases/new"><Plus className="h-4 w-4" /> Nuevo expediente</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl gap-1.5">
                  <Link href="/people/new"><UserPlus className="h-4 w-4" /> Cargar persona</Link>
                </Button>
              </>
            )}
            {canSeeReports && <ExecutiveReportButton />}
          </>
        }
      />

      {deniedAccess && (
        <div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Tu rol no tiene acceso a esa sección, por eso volviste al inicio. Si la necesitás, pedíselo a quien administra los usuarios.
        </div>
      )}

      {derivationsToAnswer > 0 && (
        <Link
          href="/cases/derivaciones"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground transition-colors hover:border-amber-500/70"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ArrowRightLeft className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {derivationsToAnswer === 1
              ? "Hay 1 expediente derivado esperando que lo aceptes o lo rechaces."
              : `Hay ${derivationsToAnswer} expedientes derivados esperando que los aceptes o los rechaces.`}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {/* Indicadores: cada uno abre el listado que cuenta */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {layout.kpis.map((id) => {
          const k = kpis[id];
          return (
            <Link
              key={id}
              href={k.href}
              aria-label={`${k.label}: ${k.value}. Ver listado`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StatCard
                className="h-full transition-colors group-hover:border-primary/40"
                label={k.label}
                value={k.value}
                icon={k.icon}
                tone={k.tone}
                hint={k.hint}
              />
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {sections.map((id) => {
          switch (id) {
            case "myCases":
              return <MyCasesCard key={id} total={myCases.total} cases={myCases.cases} />;
            case "attention":
              return <AttentionCard key={id} items={stats.attentionItems} viewAllHref={kpis.urgentCases.href} />;
            case "budget":
              return <BudgetCard key={id} stats={stats} areaName={area?.name} />;
            case "territorial":
              return (
                <div key={id} className="flex flex-col">
                  <TerritorialActivityWidget topArea={stats.topArea} locations={stats.peopleLocations || []} />
                </div>
              );
            case "recentCases":
              return <RecentCasesCard key={id} cases={stats.recentCases} viewAllHref={casesQuery({})} />;
            case "tasks":
              return <TasksCard key={id} tasks={pendingTasks} />;
            case "vehicles":
              return <VehiclesCard key={id} vehicles={stats.vehiclesList} />;
          }
        })}
      </div>
    </div>
  );
}

function CardHeaderRow({ icon: Icon, iconClass, title, href, linkLabel }: {
  icon: any; iconClass: string; title: string; href: string; linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-border/30">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <Link href={href} className="inline-flex items-center min-h-8 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 shrink-0">
        {linkLabel} <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function AttentionCard({ items, viewAllHref }: { items: DashboardStats["attentionItems"]; viewAllHref: string }) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow icon={AlertTriangle} iconClass="text-amber-500" title="Requiere atención" href={viewAllHref} linkLabel="Ver urgentes" />
      <div className="divide-y divide-border/30 mt-1">
        {items.length === 0 && (
          <EmptyMessage
            kind="done"
            icon={ShieldCheck}
            title="Nada urgente por ahora"
            description="No hay expedientes urgentes ni órdenes de compra esperando firma."
            className="py-8"
          />
        )}
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center justify-between py-3 hover:bg-muted/20 px-1 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.type === "case" ? "bg-rose-500" : "bg-amber-500"}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function BudgetCard({ stats, areaName }: { stats: DashboardStats; areaName?: string }) {
  const totalBudget = Number(stats.totalBudget || 0);
  const executedAmount = Number(stats.executedAmount || 0);
  const hasBudget = totalBudget > 0;
  const executionPercentage = hasBudget ? Math.round((executedAmount / totalBudget) * 100) : 0;
  const money = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <div className="flex items-center justify-between pb-3 border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <h3 className="text-sm font-semibold text-foreground truncate">{areaName ? `Presupuesto del área` : "Presupuesto"}</h3>
        </div>
        <Link href="/admin/budget" className="flex items-center gap-1 shrink-0">
          <span className={`text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap ${hasBudget ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {hasBudget ? `${executionPercentage}% ejecutado` : "Sin cargar"}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </Link>
      </div>

      <Link href="/admin/budget" className="grid grid-cols-3 gap-2 py-3.5 text-left border-b border-border/30 rounded-lg hover:bg-muted/20 transition-colors">
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">{money(executedAmount)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ejecutado</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">{money(Math.max(0, totalBudget - executedAmount))}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Restante</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">{money(totalBudget)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </div>
      </Link>

      {!hasBudget && (
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
          Todavía no se cargó el presupuesto anual{areaName ? " de esta área" : " de las áreas"}, por eso no se puede calcular el porcentaje ejecutado.{" "}
          <Link href="/admin/budget" className="font-medium text-primary hover:underline">Cargar presupuesto</Link>
        </p>
      )}

      {hasBudget && stats.areaBudgetProgress.length > 0 && !areaName && (
        <div className="mt-4 space-y-3">
          <span className="text-xs font-medium text-muted-foreground block">Distribución por área</span>
          {stats.areaBudgetProgress.map((a) => (
            <Link key={a.name} href="/admin/budget" className="block space-y-1 rounded-lg hover:bg-muted/20 transition-colors">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground text-xs">{a.name}</span>
                <span className="font-medium text-foreground text-xs">{a.percentage}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className={`h-full rounded-full ${a.color}`} style={{ width: `${Math.min(100, Math.max(0, a.percentage))}%` }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentCasesCard({ cases, viewAllHref }: { cases: DashboardStats["recentCases"]; viewAllHref: string }) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow icon={Users} iconClass="text-blue-600 dark:text-blue-400" title="Expedientes recientes" href={viewAllHref} linkLabel="Ver todos" />
      <div className="divide-y divide-border/20 mt-1">
        {cases.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Todavía no hay expedientes cargados.</p>
        )}
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="flex items-center justify-between gap-2 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{c.citizenName}</p>
              <p className="text-xs text-muted-foreground truncate">
                <span className="font-mono">{c.shortId}</span> · {c.type}
              </p>
            </div>
            <span className={`inline-block shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
              c.statusVariant === "pending"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : c.statusVariant === "in_progress"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            }`}>
              {c.status}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function MyCasesCard({ total, cases }: { total: number; cases: MyAssignedCase[] }) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow
        icon={FolderOpen}
        iconClass="text-primary"
        title={total > 0 ? `Mis expedientes a cargo (${total})` : "Mis expedientes a cargo"}
        href="/cases?assigned=mine"
        linkLabel="Ver todos"
      />
      {cases.length === 0 && (
        <EmptyMessage
          compact
          icon={FolderOpen}
          title="No tenés expedientes a cargo"
          description="Cuando te dejen a cargo de un expediente, o lo tomes vos, aparece acá."
        />
      )}
      <div className="divide-y divide-border/20 mt-1">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="flex items-center justify-between gap-2 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{c.titular || c.title}</p>
              <p className="text-xs text-muted-foreground truncate">{c.titular ? `${c.title} · ${c.status}` : c.status}</p>
            </div>
            <span
              className={`inline-block shrink-0 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                c.stale ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted text-muted-foreground"
              }`}
              title="Desde la última intervención o, si no tiene, desde que se abrió"
            >
              {c.quietDays <= 0 ? "Movido hoy" : c.quietDays === 1 ? "Movido ayer" : `${c.quietDays} días sin movimiento`}
            </span>
          </Link>
        ))}
      </div>
      {total > cases.length && (
        <p className="pt-2 text-xs text-muted-foreground">
          Se muestran los {cases.length} que llevan más tiempo sin movimiento.
        </p>
      )}
    </Card>
  );
}

function TasksCard({ tasks }: { tasks: { id: string; title: string; priority: string | null; dueDate: Date | null; caseId?: string | null }[] }) {
  const upcoming = tasks.slice(0, 5);
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow icon={Calendar} iconClass="text-amber-700 dark:text-amber-400" title="Mis próximas tareas" href="/tasks" linkLabel="Ver todas" />
      <div className="divide-y divide-border/20 mt-1">
        {upcoming.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No tenés tareas pendientes.</p>
        )}
        {upcoming.map((t) => {
          const priority = t.priority || "MEDIA";
          const high = priority === "URGENTE" || priority === "ALTA";
          return (
            <Link
              key={t.id}
              href={t.caseId ? `/cases/${t.caseId}` : "/tasks"}
              className="flex items-center justify-between gap-2 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors group"
            >
              <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  high
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : priority === "MEDIA"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                }`}>
                  {priority}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {t.dueDate ? formatVencimiento(t.dueDate) : "Sin fecha"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function VehiclesCard({ vehicles }: { vehicles: DashboardStats["vehiclesList"] }) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow icon={Car} iconClass="text-emerald-700 dark:text-emerald-400" title="Vehículos y logística" href="/admin/vehicles" linkLabel="Ver flota" />
      <div className="divide-y divide-border/20 mt-1">
        {vehicles.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No hay vehículos cargados en la flota.</p>
        )}
        {vehicles.map((v) => (
          <Link
            key={v.id}
            href={`/admin/vehicles/${v.id}`}
            className="flex items-center justify-between gap-2 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{v.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{v.nextExpiry}</p>
            </div>
            <span className={`inline-block shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
              v.statusVariant === "active"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : v.statusVariant === "maintenance"
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
            }`}>
              {v.status}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
