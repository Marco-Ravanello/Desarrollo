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
import { MobileList, MobileListItem, StatRow } from "@/components/ui/mobile-list";
import { MobileFilters } from "@/components/ui/mobile-filters";
import { EmptyMessage } from "@/components/ui/empty-message";
import { hasPermission, MANAGEMENT_ROLES, PERMISSIONS } from "@/lib/permissions";
import { getCaseStatusConfig } from "@/lib/status-styles";
import { getAreaShortName } from "@/lib/area-theme";
import { interventionTypeLabel } from "@/lib/intervention-types";
import { CaseTag } from "@/components/cases/case-tag";
import { CaseLabelChips } from "@/components/cases/case-label-chips";
import { caseLabelName, isCaseLabel } from "@/lib/case-labels";
import { getCaseLabelCounts } from "@/services/case-labels";
import { CASE_PRIORITY_LABEL, CASE_STATUS_LABEL, STALE_DAYS, agoText, daysText, fechaCorta, isProvisionalDni, splitCaseTitle, summarizeCase } from "@/lib/case-summary";
import { countMyOpenCases } from "@/services/case-assignment";
import prisma from "@/lib/prisma";
import {
  FileText, ShieldAlert, CheckCircle2, Clock, Plus, Search,
  ArrowRight, ClipboardList, ArrowRightLeft, AlertTriangle, UserCheck, UsersRound
} from "lucide-react";
import Link from "next/link";
import { formatNumber, plural } from "@/lib/formato";

interface CasesPageProps {
  searchParams: Promise<{
    q?: string;
    area?: string;
    status?: string;
    priority?: string;
    assigned?: string;
    quiet?: string;
    label?: string;
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

export const metadata = { title: "Expedientes" };

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q, area, status, priority, page, limit } = await searchParams;
  const { assigned: assignedRaw, quiet: quietRaw, label: labelRaw } = await searchParams;
  const label = isCaseLabel(labelRaw) ? labelRaw : undefined;
  // "mine", "none" o el id de un profesional (desde el equipo del área en el inicio).
  const assigned =
    assignedRaw === "mine" || assignedRaw === "none" || (assignedRaw && /^c[a-z0-9]{20,30}$/.test(assignedRaw)) ? assignedRaw : undefined;
  const quiet = quietRaw === "1";
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

  const canViewSensitive = hasPermission(session.user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES);
  const canSeeTeam = MANAGEMENT_ROLES.includes(session.user.role) || session.user.role === "DIRECTOR_AREA";

  const [data, areasList, derivationsToAnswer, myOpenCases, labelCounts] = await Promise.all([
    getAllCases({
      query: q,
      areaId: area,
      status,
      priority,
      assigned,
      quiet,
      label,
      userId: session.user.id,
      page: pageNum,
      limit: limitNum,
      canViewSensitive,
    }),
    getAreas(),
    countDerivationsToAnswer(session.user),
    countMyOpenCases(session.user.id),
    getCaseLabelCounts({ canViewSensitive }),
  ]);
  const assignedUser =
    assigned && assigned !== "mine" && assigned !== "none"
      ? await prisma.user.findUnique({ where: { id: assigned }, select: { name: true, username: true } }).catch(() => null)
      : null;
  const assignedLabel = assigned
    ? ASSIGNED_LABELS[assigned] ?? `A cargo de ${assignedUser?.name || assignedUser?.username || "otra persona"}`
    : null;
  const now = new Date();

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENTE":
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs font-bold">Urgente</Badge>;
      case "ALTA":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30 text-xs font-bold">Prioridad alta</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (s: string) => (
    <Badge variant="outline" className={`text-xs font-bold ${getCaseStatusConfig(s).badgeClass}`}>
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
    if (quiet) params.set("quiet", "1");
    if (label) params.set("label", label);
    params.set("page", String(n));
    return `/cases?${params.toString()}`;
  };

  const breadcrumbs = [
    { label: "Inicio", href: "/dashboard" },
    { label: "Expedientes", active: true }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <PageBreadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Expedientes"
        description="Los expedientes de todas las áreas que podés ver. Buscá, filtrá y entrá a cada uno para seguirlo."
        icon={ClipboardList}
        actions={
          <>
            <Button asChild variant={assigned === "mine" ? "default" : "outline"} className="rounded-xl font-bold text-xs gap-1.5">
              <Link href="/cases?assigned=mine">
                <UserCheck className="h-4 w-4" /> Mis expedientes
                {myOpenCases > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">{myOpenCases}</span>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-bold text-xs gap-1.5">
              <Link href="/cases/derivaciones">
                <ArrowRightLeft className="h-4 w-4" /> Derivaciones
                {derivationsToAnswer > 0 && (
                  <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">{derivationsToAnswer}</span>
                )}
              </Link>
            </Button>
            {canSeeTeam && (
              <Button asChild variant="outline" className="rounded-xl font-bold text-xs gap-1.5">
                <Link href={area ? `/cases/equipo?area=${encodeURIComponent(area)}` : "/cases/equipo"}>
                  <UsersRound className="h-4 w-4" /> Carga del equipo
                </Link>
              </Button>
            )}
            <Button asChild className="rounded-xl font-bold text-xs gap-1.5 shadow-sm">
              <Link href="/cases/new">
                <Plus className="h-4 w-4" /> Nuevo expediente
              </Link>
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <StatRow>
        <StatCard label="Todos" value={data.stats.totalAll} hint="Expedientes cargados" icon={FileText} tone="blue" />
        <StatCard label="En curso" value={data.stats.active} hint="Abiertos o en proceso" icon={Clock} tone="green" />
        <StatCard label="Urgentes" value={data.stats.urgent} hint="Prioridad urgente" icon={ShieldAlert} tone="red" />
        <StatCard label="Cerrados" value={data.stats.closed} hint="Ya resueltos" icon={CheckCircle2} tone="slate" />
      </StatRow>

      {/* Filters Form */}
      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <div className="sm:col-span-2 lg:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q || ""}
              aria-label="Buscar expedientes"
              placeholder="Buscar por carátula, DNI o apellido"
              className="pl-9 h-10 rounded-xl bg-muted/30 border-border/60 text-xs"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 sm:order-last lg:order-none">
            <Button type="submit" size="sm" className="h-10 w-full rounded-xl text-xs font-bold">
              Buscar
            </Button>
          </div>
          <MobileFilters active={[area && area !== "all", status && status !== "all", priority && priority !== "all", assigned, quiet, label].filter(Boolean).length}>
          <div>
            <select
              name="area"
              aria-label="Área"
              defaultValue={area || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas las áreas</option>
              {areasList.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              name="status"
              aria-label="Estado"
              defaultValue={status || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todos los estados</option>
              <option value="ACTIVOS">Activos (abiertos y en proceso)</option>
              <option value="ABIERTO">Abierto</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="DERIVADO">Derivado (esperando respuesta)</option>
              <option value="CERRADO">Cerrado / resuelto</option>
            </select>
          </div>
          <div>
            <select
              name="priority"
              aria-label="Prioridad"
              defaultValue={priority || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas las prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>
          <div>
            <select
              name="assigned"
              aria-label="Profesional a cargo"
              defaultValue={assigned || "all"}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Cualquier profesional a cargo</option>
              <option value="mine">Mis expedientes</option>
              <option value="none">Sin profesional a cargo</option>
              {assignedUser && <option value={assigned}>{assignedLabel}</option>}
            </select>
          </div>
          <div>
            <select
              name="label"
              aria-label="Etiqueta"
              defaultValue={label || ""}
              className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Cualquier etiqueta</option>
              {labelCounts.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label} ({formatNumber(l.total)})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
            <input type="checkbox" name="quiet" value="1" defaultChecked={quiet} className="h-4 w-4 rounded border-border" />
            Solo los que no tuvieron intervenciones hace {STALE_DAYS} días o más
          </label>
          </MobileFilters>
        </form>
        {(q || (area && area !== "all") || (status && status !== "all") || (priority && priority !== "all") || assigned || quiet || label) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/40 text-xs">
            <span className="text-xs font-bold text-muted-foreground">Filtros activos:</span>
            {q && <Badge variant="secondary" className="text-xs">Texto: {q}</Badge>}
            {area && area !== "all" && <Badge variant="secondary" className="text-xs">Área: {areasList.find((a) => a.id === area)?.name || area}</Badge>}
            {status && status !== "all" && <Badge variant="secondary" className="text-xs">Estado: {STATUS_LABELS[status] || status}</Badge>}
            {priority && priority !== "all" && <Badge variant="secondary" className="text-xs">Prioridad: {CASE_PRIORITY_LABEL[priority]?.replace(/^Prioridad /, "") ?? priority}</Badge>}
            {assignedLabel && <Badge variant="secondary" className="text-xs">{assignedLabel}</Badge>}
            {quiet && <Badge variant="secondary" className="text-xs">Sin movimiento hace {STALE_DAYS} días o más</Badge>}
            {label && <Badge variant="secondary" className="text-xs">Etiqueta: {caseLabelName(label)}</Badge>}
            <Button variant="ghost" size="sm" asChild className="h-6 text-xs text-muted-foreground hover:text-foreground">
              <Link href="/cases">Limpiar filtros</Link>
            </Button>
          </div>
        )}
      </Card>

      {/* Cases Table */}
      <Card className="rounded-2xl border-border/60 bg-card shadow-xs overflow-hidden">
        {data.cases.length === 0 ? (
          <EmptyMessage
            kind={assigned === "mine" ? "empty" : "search"}
            title={assigned === "mine" ? "No tenés expedientes a cargo" : "Ningún expediente coincide con la búsqueda"}
            description={
              assigned === "mine"
                ? "Cuando te dejen a cargo de un expediente, te llega un aviso y aparece acá."
                : "Probá con otras palabras o quitá algunos filtros."
            }
            icon={FileText}
            action={
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                <Link href="/cases">{assigned === "mine" ? "Ver todos los expedientes" : "Quitar filtros"}</Link>
              </Button>
            }
          />
        ) : (
          <>
          <MobileList label="Expedientes">
            {data.cases.map((c) => {
              const restricted = !canViewSensitive && c.area.name.toLowerCase().includes("violencia");
              const shown = splitCaseTitle(c.title);
              const summary = summarizeCase({
                status: c.status,
                createdAt: c.createdAt,
                closedAt: c.status === "CERRADO" ? c.updatedAt : null,
                lastInterventionAt: c.interventions[0]?.date ?? null,
                now,
              });
              const titular = c.person ? `${c.person.lastName}, ${c.person.firstName}` : null;
              return (
                <MobileListItem
                  key={c.id}
                  href={restricted ? undefined : `/cases/${c.id}`}
                  title={restricted ? "Expediente reservado" : titular ?? shown.title}
                  subtitle={
                    restricted
                      ? getAreaShortName(c.area.name)
                      : [titular ? shown.title : null, shown.tag, getAreaShortName(c.area.name), ...c.labels.map((k) => caseLabelName(k))].filter(Boolean).join(" · ")
                  }
                  meta={
                    restricted
                      ? undefined
                      : summary.stale
                        ? <span className="font-semibold text-amber-800 dark:text-amber-300">Sin movimiento hace {summary.quietDays} días</span>
                        : `Última intervención: ${c.interventions[0] && summary.lastInterventionDays !== null ? agoText(summary.lastInterventionDays) : "ninguna"}`
                  }
                  aside={
                    <>
                      {getStatusBadge(c.status)}
                      {getPriorityBadge(c.priority)}
                    </>
                  }
                />
              );
            })}
          </MobileList>
          <div className="hidden md:block">
          <Table mobileCards={false}>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30">
                  <TableHead className="text-xs font-bold text-muted-foreground">Expediente</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground">A cargo</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground">Abierto</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground">Última intervención</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground text-center">Acción</TableHead>
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
                  const shown = splitCaseTitle(c.title);
                  const assigneeName = c.assignedTo ? c.assignedTo.name || c.assignedTo.email || "Usuario" : null;
                  return (
                    <TableRow key={c.id} className={`border-border/60 hover:bg-muted/30 transition-colors ${summary.stale ? "bg-amber-500/[0.04]" : ""}`}>
                      <TableCell className="font-medium max-w-xs align-top">
                        {isRestricted ? (
                          <span className="italic text-muted-foreground text-xs font-semibold">Expediente reservado</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <CaseTag tag={shown.tag} />
                              <Link href={`/cases/${c.id}`} title={c.title} className="block min-w-0 truncate font-bold text-xs text-foreground hover:underline">{shown.title}</Link>
                            </div>
                            {c.person ? (
                              <div className="text-xs text-muted-foreground">
                                <Link href={`/people/${c.person.dni || c.person.id}`} className="font-semibold text-primary hover:underline">
                                  {c.person.lastName}, {c.person.firstName}
                                </Link>
                                {isProvisionalDni(c.person.dni) ? (
                                  <span> · Sin DNI</span>
                                ) : (
                                  <span className="font-mono"> · DNI {c.person.dni}</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">Sin titular</div>
                            )}
                            <CaseLabelChips labels={c.labels} max={3} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        <div className="font-semibold text-foreground" title={c.area.name}>{getAreaShortName(c.area.name)}</div>
                        <div className={`mt-0.5 flex items-center gap-1 text-xs ${assigneeName ? "text-foreground" : "text-muted-foreground"}`}>
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
                        <div className="whitespace-nowrap text-xs text-muted-foreground">desde {fechaCorta(c.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-xs align-top">
                        {isRestricted ? (
                          <span className="text-xs text-muted-foreground">Reservado</span>
                        ) : (
                          <>
                            <div className={`font-semibold ${summary.stale ? "text-amber-800 dark:text-amber-300" : "text-foreground"}`}>
                              {last && summary.lastInterventionDays !== null ? agoText(summary.lastInterventionDays) : "Ninguna todavía"}
                            </div>
                            {last && (
                              <div className="text-xs text-muted-foreground">
                                {interventionTypeLabel(last.type) ?? "Sin tipo"}
                              </div>
                            )}
                            {summary.stale && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
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
                              Ver expediente <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </Card>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>Mostrando página {data.currentPage} de {data.totalPages} ({plural(data.total, "expediente")} en total)</span>
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
