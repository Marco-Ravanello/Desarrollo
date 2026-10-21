export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllCases, getAreas } from "@/services/cases";
import { countDerivationsToAnswer } from "@/services/derivations";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getCaseStatusConfig } from "@/lib/status-styles";
import { getAreaShortName } from "@/lib/area-theme";
import { interventionTypeLabel } from "@/lib/intervention-types";
import { CASE_STATUS_LABEL, STALE_DAYS, agoText, daysText, fechaCorta, summarizeCase } from "@/lib/case-summary";
import { countMyOpenCases } from "@/services/case-assignment";
import {
  FileText, ShieldAlert, CheckCircle2, Clock, Plus, Search,
  ArrowRight, ClipboardList, ArrowRightLeft, AlertTriangle, UserCheck
} from "lucide-react";
import Link from "next/link";

interface CasesPageProps {
  searchParams: Promise<{
    q?: string;
    area?: string;
    status?: string;
    priority?: string;
    assigned?: string;
    page?: string;
    limit?: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVOS: "Activos",
  ...CASE_STATUS_LABEL,
};

const ASSIGNED_LABELS: Record<string, string> = {
  mine: "Mis expedientes",
  none: "Sin profesional a cargo",
};

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q, area, status, priority, page, limit } = await searchParams;
  const assignedRaw = (await searchParams).assigned;
  const assigned = assignedRaw === "mine" || assignedRaw === "none" ? assignedRaw : undefined;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

  const canViewSensitive = hasPermission(session.user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES);

  const [data, areasList, derivationsToAnswer, myOpenCases] = await Promise.all([
    getAllCases({
      query: q,
      areaId: area,
      status,
      priority,
      assigned,
      userId: session.user.id,
      page: pageNum,
      limit: limitNum,
      canViewSensitive,
    }),
    getAreas(),
    countDerivationsToAnswer(session.user),
    countMyOpenCases(session.user.id),
  ]);
  const now = new Date();

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENTE":
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-bold">Urgente</Badge>;
      case "ALTA":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30 text-[10px] font-bold">Prioridad alta</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (s: string) => (
    <Badge variant="outline" className={`text-[11px] font-bold ${getCaseStatusConfig(s).badgeClass}`}>
      {CASE_STATUS_LABEL[s] ?? s}
    </Badge>
  );

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (area) params.set("area", area);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (assigned) params.set("assigned", assigned);
    params.set("page", String(n));
    return `/cases?${params.toString()}`;
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Expedientes y Casos", active: true }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <PageBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Expedientes y Casos Sociales"
        description="Bandeja unificada de seguimiento, intervenciones y resolución territorial de todas las áreas municipales."
        icon={ClipboardList}
        badge="Gestión Integral"
        actions={
          <>
            <Button asChild variant={assigned === "mine" ? "default" : "outline"} className="rounded-xl font-bold text-xs gap-1.5">
              <Link href="/cases?assigned=mine">
                <UserCheck className="h-4 w-4" /> Mis expedientes
                {myOpenCases > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">{myOpenCases}</span>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-bold text-xs gap-1.5">
              <Link href="/cases/derivaciones">
                <ArrowRightLeft className="h-4 w-4" /> Derivaciones
                {derivationsToAnswer > 0 && (
                  <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{derivationsToAnswer}</span>
                )}
              </Link>
            </Button>
            <Button asChild className="rounded-xl font-bold text-xs gap-1.5 shadow-sm">
              <Link href="/cases/new">
                <Plus className="h-4 w-4" /> Nuevo Expediente
              </Link>
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Casos" value={data.stats.totalAll} hint="Registrados en el sistema" icon={FileText} tone="blue" />
        <StatCard label="En Curso" value={data.stats.active} hint="Abiertos o en proceso" icon={Clock} tone="green" />
        <StatCard label="Alertas Urgentes" value={data.stats.urgent} hint="Prioridad máxima" icon={ShieldAlert} tone="red" />
        <StatCard label="Resueltos" value={data.stats.closed} hint="Casos cerrados" icon={CheckCircle2} tone="slate" />
      </div>

      {/* Filters Form */}
      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q || ""}
              placeholder="Buscar por carátula, DNI o apellido..."
              className="pl-9 h-10 rounded-xl bg-muted/30 border-border/60 text-xs"
            />
          </div>
          <div className="lg:col-span-2">
            <select
              name="area"
              defaultValue={area || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas las Áreas Municipales</option>
              {areasList.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <select
              name="status"
              defaultValue={status || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todos los Estados</option>
              <option value="ACTIVOS">Activos (abiertos y en proceso)</option>
              <option value="ABIERTO">Abierto</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="DERIVADO">Derivado (esperando respuesta)</option>
              <option value="CERRADO">Cerrado / Resuelto</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select
              name="priority"
              defaultValue={priority || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas las Prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select
              name="assigned"
              aria-label="Profesional a cargo"
              defaultValue={assigned || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Cualquier profesional</option>
              <option value="mine">Mis expedientes</option>
              <option value="none">Sin profesional a cargo</option>
            </select>
          </div>
          <div className="lg:col-span-1 flex gap-1">
            <Button type="submit" size="sm" className="h-10 w-full rounded-xl text-xs font-bold">
              Filtrar
            </Button>
          </div>
        </form>
        {(q || (area && area !== "all") || (status && status !== "all") || (priority && priority !== "all") || assigned) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/40 text-xs">
            <span className="text-[11px] font-bold text-muted-foreground">Filtros activos:</span>
            {q && <Badge variant="secondary" className="text-[10px]">Texto: {q}</Badge>}
            {area && area !== "all" && <Badge variant="secondary" className="text-[10px]">Área: {areasList.find((a) => a.id === area)?.name || area}</Badge>}
            {status && status !== "all" && <Badge variant="secondary" className="text-[10px]">Estado: {STATUS_LABELS[status] || status}</Badge>}
            {priority && priority !== "all" && <Badge variant="secondary" className="text-[10px]">Prioridad: {priority}</Badge>}
            {assigned && <Badge variant="secondary" className="text-[10px]">{ASSIGNED_LABELS[assigned]}</Badge>}
            <Button variant="ghost" size="sm" asChild className="h-6 text-[10px] text-muted-foreground hover:text-foreground">
              <Link href="/cases">Limpiar Filtros</Link>
            </Button>
          </div>
        )}
      </Card>

      {/* Cases Table */}
      <Card className="rounded-2xl border-border/60 bg-card shadow-xs overflow-hidden">
        {data.cases.length === 0 ? (
          <EmptyMessage
            title={assigned === "mine" ? "No tenés expedientes a cargo" : "No se encontraron expedientes"}
            description={
              assigned === "mine"
                ? "Cuando te dejen a cargo de un expediente, te llega un aviso y aparece acá."
                : "No hay casos que coincidan con los criterios de búsqueda o filtros seleccionados."
            }
            icon={FileText}
            action={
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                <Link href="/cases">Restablecer búsqueda</Link>
              </Button>
            }
          />
        ) : (
          <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30">
                  <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">Expediente</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">A cargo</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">Abierto</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">Última intervención</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase text-muted-foreground text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cases.map((c) => {
                  const isViolence =
                    c.area.name === "Violencia de Género" ||
                    c.area.name.toLowerCase().includes("violencia");
                  const isRestricted = isViolence && !canViewSensitive;
                  const last = c.interventions[0] ?? null;
                  const summary = summarizeCase({
                    status: c.status,
                    createdAt: c.createdAt,
                    closedAt: c.status === "CERRADO" ? c.updatedAt : null,
                    lastInterventionAt: last?.date ?? null,
                    now,
                  });
                  const assigneeName = c.assignedTo ? c.assignedTo.name || c.assignedTo.email || "Usuario" : null;
                  return (
                    <TableRow key={c.id} className={`border-border/60 hover:bg-muted/30 transition-colors ${summary.stale ? "bg-amber-500/[0.04]" : ""}`}>
                      <TableCell className="font-medium max-w-xs align-top">
                        {isRestricted ? (
                          <span className="italic text-muted-foreground text-xs font-semibold">Expediente Confidencial Reservado</span>
                        ) : (
                          <div className="space-y-1">
                            <Link href={`/cases/${c.id}`} className="block truncate font-bold text-xs text-foreground hover:underline">{c.title}</Link>
                            {c.person ? (
                              <div className="text-[11px] text-muted-foreground">
                                <Link href={`/people/${c.person.dni || c.person.id}`} className="font-semibold text-primary hover:underline">
                                  {c.person.lastName}, {c.person.firstName}
                                </Link>
                                <span className="font-mono"> · DNI {c.person.dni}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground">Sin titular</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        <div className="font-semibold text-foreground" title={c.area.name}>{getAreaShortName(c.area.name)}</div>
                        <div className={`mt-0.5 flex items-center gap-1 text-[11px] ${assigneeName ? "text-foreground" : "text-muted-foreground"}`}>
                          <UserCheck className="h-3 w-3 shrink-0" />
                          {isRestricted ? "Reservado" : assigneeName ?? "Sin profesional"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap items-center gap-1">
                          {getStatusBadge(c.status)}
                          {getPriorityBadge(c.priority)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        <div className="whitespace-nowrap font-semibold text-foreground">{daysText(summary.openDays)}</div>
                        <div className="whitespace-nowrap text-[11px] text-muted-foreground">desde {fechaCorta(c.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        {isRestricted ? (
                          <span className="text-[11px] text-muted-foreground">Reservado</span>
                        ) : (
                          <>
                            <div className={`font-semibold ${summary.stale ? "text-amber-800 dark:text-amber-300" : "text-foreground"}`}>
                              {last && summary.lastInterventionDays !== null ? agoText(summary.lastInterventionDays) : "Ninguna todavía"}
                            </div>
                            {last && (
                              <div className="text-[11px] text-muted-foreground">
                                {interventionTypeLabel(last.type) ?? "Sin tipo"}
                              </div>
                            )}
                            {summary.stale && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" /> Sin movimiento hace {STALE_DAYS}+ días
                              </div>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-top">
                        {isRestricted ? (
                          <Button disabled variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-bold text-muted-foreground opacity-50 cursor-not-allowed">
                            Reservado
                          </Button>
                        ) : (
                          <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-bold">
                            <Link href={`/cases/${c.id}`}>
                              Ver <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
        )}
      </Card>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>Mostrando página {data.currentPage} de {data.totalPages} ({data.total} casos en total)</span>
          <div className="flex gap-1">
            {data.currentPage > 1 && (
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                <Link href={pageHref(data.currentPage - 1)}>
                  Anterior
                </Link>
              </Button>
            )}
            {data.currentPage < data.totalPages && (
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                <Link href={pageHref(data.currentPage + 1)}>
                  Siguiente
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
