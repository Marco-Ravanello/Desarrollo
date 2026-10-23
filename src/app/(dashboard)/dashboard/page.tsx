export const dynamic = "force-dynamic";

import {
  getDashboardStats, countStaleCases, countPendingDerivations, getAreaOverview, getAreaTeam, getQuietCases, getFollowUpsDue,
  type DashboardStats, type AreaOverviewRow, type TeamMemberRow, type QuietCase, type DueFollowUp, type DashboardScope,
} from "@/services/dashboard";
import { getTasks } from "@/services/system";
import { countDerivationsToAnswer } from "@/services/derivations";
import { getMyAssignedCases, type MyAssignedCase } from "@/services/cases";
import { getRecentAuditActivity } from "@/services/audit";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import {
  Users, FileText, CheckCircle2, ShieldCheck,
  Plus, UserPlus, ChevronRight, AlertTriangle,
  Car, Calendar, ArrowUpRight, LayoutDashboard, Wallet, FileSignature, ArrowRightLeft, FolderOpen,
  Hourglass, Building2, UsersRound, CalendarCheck, ScrollText,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard, type StatTone } from "@/components/ui/stat-card";
import { StatRow, MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";
import { Button } from "@/components/ui/button";
import { ExecutiveReportButton } from "../admin/reports/executive-report-button";
import { TerritorialActivityWidget } from "@/components/dashboard/territorial-activity-widget";
import { ViewAsSelector, type ViewAsOption } from "@/components/dashboard/view-as-selector";
import Link from "next/link";
import { formatFechaHora, formatVencimiento } from "@/lib/fechas";
import { formatNumber, plural, textoNormal } from "@/lib/formato";
import { getAreaShortName } from "@/lib/area-theme";
import { roleLabel } from "@/lib/roles";
import { STALE_DAYS } from "@/lib/case-summary";
import { auditLink, describeAuditAction, formatAuditDetails } from "@/lib/audit-labels";

/**
 * Cada rol ve primero lo suyo:
 * - superadmin: todo, más "Ver el inicio como…" para revisar cómo lo ve cada rol.
 * - conduccion (Dirección General): un resumen por área, sin listas de expedientes sueltos.
 * - administracion (Administración General): compras, presupuesto, vehículos y lo urgente.
 * - area (Dirección de Área): su área, con el equipo y los expedientes quietos.
 * - operativo (Operativo, Violencia de Género): sus expedientes, los seguimientos del día y sus tareas.
 * - auditor: los últimos movimientos y los indicadores, sin accesos para cargar datos.
 */
type Profile = "superadmin" | "conduccion" | "administracion" | "area" | "operativo" | "auditor";

function profileFor(role: Role): Profile {
  switch (role) {
    case "SUPERADMIN":
      return "superadmin";
    case "DIRECCION_GENERAL":
      return "conduccion";
    case "ADMIN_GENERAL":
      return "administracion";
    case "DIRECTOR_AREA":
      return "area";
    case "AUDITOR":
      return "auditor";
    default:
      return "operativo";
  }
}

type KpiId =
  | "people" | "activeCases" | "urgentCases" | "pendingOrders" | "myTasks"
  | "staleCases" | "pendingDerivations" | "myCases" | "followUpsToday";
type SectionId =
  | "myCases" | "attention" | "budget" | "territorial" | "recentCases" | "tasks" | "vehicles"
  | "areas" | "team" | "quietCases" | "followUps" | "activity";

const LAYOUT: Record<Profile, { kpis: KpiId[]; sections: SectionId[] }> = {
  superadmin: {
    kpis: ["people", "activeCases", "urgentCases", "pendingOrders"],
    sections: ["areas", "attention", "budget", "territorial", "recentCases", "tasks", "vehicles"],
  },
  conduccion: {
    kpis: ["activeCases", "urgentCases", "staleCases", "pendingDerivations"],
    sections: ["areas", "tasks", "territorial"],
  },
  administracion: {
    kpis: ["people", "activeCases", "urgentCases", "pendingOrders"],
    sections: ["attention", "budget", "vehicles", "territorial", "recentCases", "tasks"],
  },
  area: {
    kpis: ["activeCases", "urgentCases", "staleCases", "pendingDerivations"],
    sections: ["team", "quietCases", "attention", "tasks", "budget"],
  },
  operativo: {
    kpis: ["myCases", "followUpsToday", "myTasks", "urgentCases"],
    sections: ["myCases", "followUps", "tasks"],
  },
  auditor: {
    kpis: ["people", "activeCases", "urgentCases", "pendingOrders"],
    sections: ["activity", "attention", "budget", "recentCases", "territorial"],
  },
};

/** Las tarjetas anchas ocupan dos columnas en la compu. */
const WIDE: SectionId[] = ["areas", "team", "activity"];

/** Roles que el Superadmin puede elegir en "Ver el inicio como…". */
const VIEW_AS: { role: Role; needsArea: boolean }[] = [
  { role: "DIRECCION_GENERAL", needsArea: false },
  { role: "ADMIN_GENERAL", needsArea: false },
  { role: "DIRECTOR_AREA", needsArea: true },
  { role: "OPERATIVO", needsArea: true },
  { role: "VIOLENCIA_GENERO", needsArea: true },
  { role: "AUDITOR", needsArea: false },
];

export const metadata = { title: "Inicio" };

/**
 * Para que la última fila no quede con una sola tarjeta: la última se estira hasta completar la fila.
 * Las clases van escritas enteras para que Tailwind las encuentre.
 */
function gridSpans(sections: SectionId[]): string[] {
  const lg = sections.map((id) => (WIDE.includes(id) ? 2 : 1));
  const md = sections.map((id) => (WIDE.includes(id) ? 2 : 1));
  const lgClass: Record<number, string> = { 1: "", 2: "lg:col-span-2", 3: "lg:col-span-3" };
  const mdClass: Record<number, string> = { 1: "", 2: "md:col-span-2" };
  const lgRest = lg.reduce((a, b) => a + b, 0) % 3;
  const mdRest = md.reduce((a, b) => a + b, 0) % 2;
  return sections.map((_, i) => {
    const last = i === sections.length - 1;
    const lgSpan = last && lgRest !== 0 ? lg[i] + (3 - lgRest) : lg[i];
    const mdSpan = last && mdRest !== 0 ? 2 : md[i];
    return [mdClass[mdSpan], lgClass[lgSpan] || (lgSpan === 1 && mdSpan === 2 ? "lg:col-span-1" : "")].filter(Boolean).join(" ");
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ "sin-permiso"?: string; como?: string; area?: string }>;
}) {
  const params = await searchParams;
  const deniedAccess = params["sin-permiso"] === "1";
  const session = await auth();
  const realRole = (session?.user?.role || "OPERATIVO") as Role;
  const isSuperadmin = realRole === "SUPERADMIN";

  // "Ver el inicio como…": solo el Superadmin, y solo cambia lo que se muestra (no los permisos).
  const viewAs = isSuperadmin ? VIEW_AS.find((v) => v.role === params.como) ?? null : null;
  const role: Role = viewAs?.role ?? realRole;
  const profile = profileFor(role);
  const canViewSensitive = hasPermission(role, PERMISSIONS.VIEW_SENSITIVE_CASES);

  const allAreas = isSuperadmin
    ? await prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }).catch(() => [])
    : [];
  let areaId: string | null;
  if (viewAs?.needsArea) {
    const requested = allAreas.find((a) => a.id === params.area);
    const fallback =
      viewAs.role === "VIOLENCIA_GENERO"
        ? allAreas.find((a) => a.name.toLowerCase().includes("violencia"))
        : allAreas.find((a) => a.id === session?.user?.areaId) ?? allAreas.find((a) => !a.name.toLowerCase().includes("violencia"));
    areaId = (requested ?? fallback ?? allAreas[0])?.id ?? null;
  } else if (viewAs) {
    areaId = null;
  } else {
    // Conducción y auditoría miran toda la gestión; el resto, su área (si tiene una asignada).
    areaId = ["superadmin", "conduccion", "administracion", "auditor"].includes(profile) ? null : session?.user?.areaId || null;
  }
  const scope: DashboardScope = { areaId, canViewSensitive };

  const layout = LAYOUT[profile];
  const wants = (id: KpiId | SectionId) => (layout.kpis as string[]).includes(id) || (layout.sections as string[]).includes(id);
  const userId = session?.user?.id;

  const [stats, myTasks, area, derivationsToAnswer, myCases, staleCount, pendingDerivations, areaRows, team, quiet, followUps, activity] =
    await Promise.all([
      getDashboardStats(scope),
      userId ? getTasks(userId).catch(() => []) : Promise.resolve([]),
      areaId ? prisma.area.findUnique({ where: { id: areaId }, select: { name: true } }).catch(() => null) : null,
      session?.user && !viewAs ? countDerivationsToAnswer(session.user).catch(() => 0) : 0,
      userId ? getMyAssignedCases(userId).catch(() => ({ total: 0, cases: [] })) : { total: 0, cases: [] },
      wants("staleCases") ? countStaleCases(scope) : 0,
      wants("pendingDerivations") ? countPendingDerivations(scope) : 0,
      wants("areas") ? getAreaOverview(scope).catch(() => []) : [],
      wants("team") && areaId ? getAreaTeam({ ...scope, areaId }).catch(() => []) : [],
      wants("quietCases") ? getQuietCases(scope).catch(() => []) : [],
      userId && wants("followUps") ? getFollowUpsDue(userId).catch(() => []) : [],
      wants("activity") ? getRecentAuditActivity().catch(() => []) : [],
    ]);

  // Mismas tareas que muestra "Mis tareas": las del usuario que no están completadas.
  // Los seguimientos que ya aparecen en "Seguimientos para hoy" no se repiten.
  const followUpIds = new Set(followUps.map((f) => f.id));
  const pendingTasks = myTasks.filter((t) => t.status !== "COMPLETADA");
  const listedTasks = pendingTasks.filter((t) => !followUpIds.has(t.id));
  const highPriorityTasksCount = pendingTasks.filter((t) => t.priority === "ALTA" || t.priority === "URGENTE").length;

  const casesQuery = (extra: Record<string, string>) =>
    `/cases?${new URLSearchParams({ ...(areaId ? { area: areaId } : {}), ...extra })}`;

  const kpis: Record<KpiId, { href: string; label: string; value: string | number; icon: any; tone: StatTone; hint: React.ReactNode }> = {
    people: {
      href: "/people",
      label: "Personas registradas",
      value: formatNumber(stats.peopleCount),
      icon: Users,
      tone: "blue",
      hint: "En el padrón unificado",
    },
    activeCases: {
      href: casesQuery({ status: "ACTIVOS" }),
      label: area ? "Expedientes abiertos del área" : "Expedientes abiertos",
      value: formatNumber(stats.activeCases),
      icon: FileText,
      tone: "blue",
      hint: "Abiertos o en proceso",
    },
    urgentCases: {
      href: casesQuery({ status: "ACTIVOS", priority: "URGENTE" }),
      label: profile === "operativo" && area ? "Urgentes del área" : "Expedientes urgentes",
      value: formatNumber(stats.criticalCases),
      icon: stats.criticalCases > 0 ? AlertTriangle : ShieldCheck,
      tone: stats.criticalCases > 0 ? "red" : "green",
      hint: stats.criticalCases > 0
        ? <span className="text-rose-600 dark:text-rose-400 font-medium">Requieren atención</span>
        : <span className="text-emerald-700 dark:text-emerald-400 font-medium">Todo en orden</span>,
    },
    staleCases: {
      href: casesQuery({ quiet: "1" }),
      label: "Sin movimiento",
      value: formatNumber(staleCount),
      icon: Hourglass,
      tone: staleCount > 0 ? "orange" : "green",
      hint: `Sin intervenciones hace ${STALE_DAYS} días o más`,
    },
    pendingDerivations: {
      href: "/cases/derivaciones",
      label: "Derivaciones sin responder",
      value: formatNumber(pendingDerivations),
      icon: ArrowRightLeft,
      tone: pendingDerivations > 0 ? "orange" : "green",
      hint: pendingDerivations > 0 ? (area ? "Esperan que el área responda" : "Esperan respuesta de un área") : "Ninguna pendiente",
    },
    pendingOrders: {
      href: "/admin/purchase-orders?status=PENDIENTE_APROBACION",
      label: "Órdenes por firmar",
      value: formatNumber(stats.pendingPurchaseOrders),
      icon: FileSignature,
      tone: stats.pendingPurchaseOrders > 0 ? "orange" : "green",
      hint: stats.pendingPurchaseOrders > 0 ? "Esperan aprobación" : "Ninguna pendiente",
    },
    myTasks: {
      href: "/tasks",
      label: "Mis tareas pendientes",
      value: formatNumber(pendingTasks.length),
      icon: CheckCircle2,
      tone: "orange",
      hint: highPriorityTasksCount > 0
        ? <span className="text-orange-700 dark:text-orange-400 font-medium">{plural(highPriorityTasksCount, "de alta prioridad", "de alta prioridad")}</span>
        : "Ninguna de alta prioridad",
    },
    myCases: {
      href: "/cases?assigned=mine",
      label: "Mis expedientes a cargo",
      value: formatNumber(myCases.total),
      icon: FolderOpen,
      tone: "blue",
      hint: myCases.cases.some((c) => c.stale)
        ? <span className="text-amber-700 dark:text-amber-400 font-medium">Hay expedientes sin movimiento</span>
        : "Sin cerrar",
    },
    followUpsToday: {
      href: "/tasks",
      label: "Seguimientos para hoy",
      value: formatNumber(followUps.length),
      icon: CalendarCheck,
      tone: followUps.some((f) => f.overdueDays > 0) ? "red" : followUps.length > 0 ? "orange" : "green",
      hint: followUps.some((f) => f.overdueDays > 0)
        ? <span className="text-rose-600 dark:text-rose-400 font-medium">{plural(followUps.filter((f) => f.overdueDays > 0).length, "atrasado")}</span>
        : followUps.length > 0 ? "Vencen hoy" : "Nada para hoy",
    },
  };

  // "Mis expedientes a cargo" aparece primero para quien tiene expedientes asignados.
  // El Superadmin la ve siempre (se usa para probar todo), aunque no tenga expedientes a cargo.
  const showMyCases = !layout.sections.includes("myCases") && (myCases.total > 0 || (isSuperadmin && !viewAs));
  const sections: SectionId[] = showMyCases ? ["myCases", ...layout.sections] : layout.sections;
  const spans = gridSpans(sections);
  const canLoadData = profile !== "auditor" && profile !== "conduccion";
  const canSeeReports = hasPermission(role, PERMISSIONS.VIEW_REPORTS);

  const firstName = (session?.user?.name || "").trim().split(/\s+/)[0];
  const now = new Date();
  const hour = Number(now.toLocaleString("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }));
  const greeting = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const todayLabel = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });
  const scopeLabel = area ? `Resumen de ${area.name}` : "Resumen de la gestión";

  const viewAsOptions: ViewAsOption[] = VIEW_AS.map((v) => ({ value: v.role, label: roleLabel(v.role), needsArea: v.needsArea }));

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

      {isSuperadmin && (
        <div className="space-y-2">
          <ViewAsSelector options={viewAsOptions} areas={allAreas} current={viewAs?.role ?? ""} currentArea={areaId} />
          {viewAs && (
            <p role="status" className="text-xs text-muted-foreground">
              Así se ve el inicio para {roleLabel(viewAs.role)}{area ? ` de ${area.name}` : ""}. Los números son los de ese rol; tus tareas, seguimientos y expedientes a cargo son los tuyos.
            </p>
          )}
        </div>
      )}

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
      <StatRow>
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
      </StatRow>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {sections.map((id, i) => {
          const span = spans[i];
          switch (id) {
            case "myCases":
              return <div key={id} className={span}><MyCasesCard total={myCases.total} cases={myCases.cases} /></div>;
            case "attention":
              return <div key={id} className={span}><AttentionCard items={stats.attentionItems} viewAllHref={kpis.urgentCases.href} /></div>;
            case "budget":
              return <div key={id} className={span}><BudgetCard stats={stats} areaName={area?.name} /></div>;
            case "territorial":
              return (
                <div key={id} className={`flex flex-col ${span}`}>
                  <TerritorialActivityWidget topArea={stats.topArea} locations={stats.peopleLocations || []} />
                </div>
              );
            case "recentCases":
              return <div key={id} className={span}><RecentCasesCard cases={stats.recentCases} viewAllHref={casesQuery({})} /></div>;
            case "tasks":
              return <div key={id} className={span}><TasksCard tasks={listedTasks} /></div>;
            case "vehicles":
              return <div key={id} className={span}><VehiclesCard vehicles={stats.vehiclesList} /></div>;
            case "areas":
              return <div key={id} className={span}><AreasCard rows={areaRows} /></div>;
            case "team":
              return <div key={id} className={span}><TeamCard rows={team} areaId={areaId} areaName={area?.name} /></div>;
            case "quietCases":
              return <div key={id} className={span}><QuietCasesCard cases={quiet} total={staleCount} viewAllHref={casesQuery({ quiet: "1" })} /></div>;
            case "followUps":
              return <div key={id} className={span}><FollowUpsCard items={followUps} /></div>;
            case "activity":
              return <div key={id} className={span}><ActivityCard entries={activity} /></div>;
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
                {getAreaShortName(c.type)} · Desde el {c.openedOn}
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
                  {textoNormal(priority)}
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

function AreasCard({ rows }: { rows: AreaOverviewRow[] }) {
  const cell = (n: number, href: string, warn = false) =>
    n > 0 ? (
      <Link href={href} className={`font-semibold hover:underline ${warn ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>
        {formatNumber(n)}
      </Link>
    ) : (
      <span className="text-muted-foreground">0</span>
    );
  const href = (areaId: string, extra: Record<string, string>) => `/cases?${new URLSearchParams({ area: areaId, ...extra })}`;
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow icon={Building2} iconClass="text-primary" title="Cómo está cada área" href="/cases?status=ACTIVOS" linkLabel="Ver expedientes" />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Todavía no hay áreas cargadas.</p>
      ) : (
        <>
          <MobileList className="-mx-5 mt-1" label="Áreas">
            {rows.map((r) => (
              <MobileListItem
                key={r.id}
                href={href(r.id, { status: "ACTIVOS" })}
                title={getAreaShortName(r.name)}
                subtitle={`${plural(r.open, "abierto")} · ${plural(r.urgent, "urgente")}`}
                meta={
                  r.stale > 0 || r.derivations > 0
                    ? [r.stale > 0 ? `${formatNumber(r.stale)} sin movimiento` : null, r.derivations > 0 ? plural(r.derivations, "derivación sin responder", "derivaciones sin responder") : null]
                        .filter(Boolean)
                        .join(" · ")
                    : undefined
                }
              />
            ))}
          </MobileList>
          <table className="hidden md:table w-full mt-2 text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 font-medium">Área</th>
                <th className="py-2 font-medium text-right">Abiertos</th>
                <th className="py-2 font-medium text-right">Urgentes</th>
                <th className="py-2 font-medium text-right" title={`Sin intervenciones hace ${STALE_DAYS} días o más`}>Sin movimiento</th>
                <th className="py-2 font-medium text-right">Derivaciones sin responder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-2">
                    <Link href={href(r.id, { status: "ACTIVOS" })} className="font-medium text-foreground hover:text-primary">
                      {getAreaShortName(r.name)}
                    </Link>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{cell(r.open, href(r.id, { status: "ACTIVOS" }))}</td>
                  <td className="py-2.5 text-right tabular-nums">{cell(r.urgent, href(r.id, { status: "ACTIVOS", priority: "URGENTE" }), true)}</td>
                  <td className="py-2.5 text-right tabular-nums">{cell(r.stale, href(r.id, { quiet: "1" }), true)}</td>
                  <td className="py-2.5 text-right tabular-nums">{cell(r.derivations, "/cases/derivaciones", true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

function TeamCard({ rows, areaId, areaName }: { rows: TeamMemberRow[]; areaId: string | null; areaName?: string }) {
  const listHref = (userId: string | null) =>
    `/cases?${new URLSearchParams({ ...(areaId ? { area: areaId } : {}), assigned: userId ?? "none" })}`;
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow
        icon={UsersRound}
        iconClass="text-primary"
        title={areaName ? `Equipo de ${getAreaShortName(areaName)}` : "Equipo del área"}
        href={areaId ? `/cases?area=${areaId}&status=ACTIVOS` : "/cases"}
        linkLabel="Ver expedientes"
      />
      {!areaId ? (
        <EmptyMessage compact icon={UsersRound} title="Tu usuario no tiene un área asignada" description="Pedile a quien administra los usuarios que te asigne tu área." />
      ) : rows.length === 0 ? (
        <EmptyMessage compact icon={UsersRound} title="Todavía no hay profesionales en el área" description="Cuando se carguen usuarios del área, aparecen acá con sus expedientes." />
      ) : (
        <div className="divide-y divide-border/20 mt-1">
          {rows.map((r) => (
            <Link
              key={r.userId ?? "sin-asignar"}
              href={listHref(r.userId)}
              className="flex items-center justify-between gap-3 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors group"
            >
              <span className={`min-w-0 truncate text-xs font-medium group-hover:text-primary ${r.userId ? "text-foreground" : "italic text-muted-foreground"}`}>
                {r.name}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-foreground">{plural(r.open, "expediente")}</span>
                {r.stale > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-300">
                    {formatNumber(r.stale)} sin movimiento
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function QuietCasesCard({ cases, total, viewAllHref }: { cases: QuietCase[]; total: number; viewAllHref: string }) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow
        icon={Hourglass}
        iconClass="text-amber-600 dark:text-amber-400"
        title={total > 0 ? `Sin movimiento (${formatNumber(total)})` : "Sin movimiento"}
        href={viewAllHref}
        linkLabel="Ver todos"
      />
      {cases.length === 0 ? (
        <EmptyMessage compact kind="done" icon={Hourglass} title="Ningún expediente quieto" description={`Todos tuvieron alguna intervención en los últimos ${STALE_DAYS} días.`} />
      ) : (
        <div className="divide-y divide-border/20 mt-1">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between gap-2 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors group">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{c.titular || c.title}</p>
                <p className="text-xs text-muted-foreground truncate">{c.assignee ? `A cargo: ${c.assignee}` : "Sin profesional a cargo"}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300 whitespace-nowrap">
                {c.quietDays} días
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function FollowUpsCard({ items }: { items: DueFollowUp[] }) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow icon={CalendarCheck} iconClass="text-primary" title="Seguimientos para hoy" href="/tasks" linkLabel="Ver tareas" />
      {items.length === 0 ? (
        <EmptyMessage compact kind="done" icon={CalendarCheck} title="Nada agendado para hoy" description="Los seguimientos que agendes desde un expediente aparecen acá el día que vencen." />
      ) : (
        <div className="divide-y divide-border/20 mt-1">
          {items.map((f) => (
            <Link key={f.id} href={`/cases/${f.caseId}`} className="flex items-center justify-between gap-2 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors group">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{f.title}</p>
                <p className="text-xs text-muted-foreground truncate">{f.caseTitle}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                  f.overdueDays > 0 ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                }`}
              >
                {f.overdueDays <= 0 ? "Hoy" : f.overdueDays === 1 ? "Atrasado 1 día" : `Atrasado ${f.overdueDays} días`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function ActivityCard({ entries }: { entries: Awaited<ReturnType<typeof getRecentAuditActivity>> }) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full">
      <CardHeaderRow icon={ScrollText} iconClass="text-primary" title="Últimos movimientos" href="/admin/audit" linkLabel="Ver Auditoría" />
      {entries.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Todavía no hay movimientos registrados.</p>
      ) : (
        <div className="divide-y divide-border/20 mt-1">
          {entries.map((e) => {
            const href = auditLink(e);
            const details = formatAuditDetails(e.details);
            const body = (
              <>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {describeAuditAction(e.action, e.entity).label}
                    {details && <span className="font-normal text-muted-foreground"> · {details}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{e.user.name || e.user.username || "Usuario"}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground font-mono">{formatFechaHora(e.createdAt)}</span>
              </>
            );
            return href ? (
              <Link key={e.id} href={href} className="flex items-center justify-between gap-3 py-2.5 px-1 rounded-lg hover:bg-muted/20 transition-colors">
                {body}
              </Link>
            ) : (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 px-1">{body}</div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
