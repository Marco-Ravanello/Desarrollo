export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, FolderOpen, Hourglass, UserX, UsersRound } from "lucide-react";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { hasPermission, MANAGEMENT_ROLES, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { getAreaShortName } from "@/lib/area-theme";
import { formatNumber, plural } from "@/lib/formato";
import { splitCaseTitle, STALE_DAYS } from "@/lib/case-summary";
import { canViewTeamWorkload, pickLeastLoaded } from "@/lib/team-workload";
import { getTeamWorkload, getUnassignedCases, UNASSIGNED_LIST_LIMIT } from "@/services/team-workload";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { MobileList, MobileListItem, StatRow } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { CaseTag } from "@/components/cases/case-tag";
import { QuickAssign } from "@/components/cases/quick-assign";
import { TeamAreaSelect } from "@/components/cases/team-area-select";

export const metadata = { title: "Carga del equipo" };

export default async function TeamWorkloadPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = session.user;
  const isManagement = MANAGEMENT_ROLES.includes(user.role);
  if (!isManagement && user.role !== "DIRECTOR_AREA") redirect("/cases");

  const canViewSensitive = hasPermission(user.role, PERMISSIONS.VIEW_SENSITIVE_CASES);
  const areas = isManagement
    ? (await prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })).filter(
        (a) => canViewSensitive || !isSensitiveArea(a.name)
      )
    : [];

  const { area: requested } = await searchParams;
  const areaId = isManagement
    ? areas.find((a) => a.id === requested)?.id ?? areas.find((a) => a.id === user.areaId)?.id ?? areas[0]?.id ?? null
    : user.areaId ?? null;

  if (!areaId || !canViewTeamWorkload(user, areaId)) {
    return (
      <EmptyMessage
        icon={UsersRound}
        title="Tu usuario no tiene un área asignada"
        description="Pedile a quien administra los usuarios que te asigne tu área."
        className="rounded-2xl border-2 border-dashed border-border/60"
      />
    );
  }

  const scope = { areaId, canViewSensitive };
  const [workload, unassignedCases] = await Promise.all([getTeamWorkload(scope), getUnassignedCases(scope)]);
  if (!workload) redirect("/cases");

  const { area, rows, unassigned, totals } = workload;
  const areaLabel = getAreaShortName(area.name);
  const suggested = pickLeastLoaded(rows);
  const assignable = rows.filter((r) => r.member && r.eligible).sort((a, b) => a.open - b.open || a.name.localeCompare(b.name, "es"));
  const maxOpen = Math.max(1, ...rows.map((r) => r.open));
  const casesHref = (params: Record<string, string>) => `/cases?${new URLSearchParams({ area: area.id, ...params })}`;

  const countLink = (n: number, href: string, warn = false) =>
    n === 0 ? (
      <span className="text-muted-foreground">0</span>
    ) : (
      <Link href={href} className={`font-semibold hover:underline ${warn ? "text-amber-700 dark:text-amber-400" : "text-foreground hover:text-primary"}`}>
        {formatNumber(n)}
      </Link>
    );

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Expedientes", href: "/cases" },
          { label: "Carga del equipo", active: true },
        ]}
      />
      <PageHeader
        title="Carga del equipo"
        description={`Cuántos expedientes sin cerrar tiene cada profesional de ${areaLabel}, para repartir mejor. Tocá un número para ver esos expedientes.`}
        icon={UsersRound}
        actions={
          <div className="flex items-center gap-2">
            {isManagement && <TeamAreaSelect areaId={area.id} areas={areas.map((a) => ({ id: a.id, name: getAreaShortName(a.name) }))} />}
            <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex rounded-xl">
              <Link href="/cases" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
          </div>
        }
      />

      <StatRow className="lg:grid-cols-4">
        <StatCard label="Sin cerrar" value={formatNumber(totals.open)} hint={`En ${areaLabel}`} icon={FolderOpen} tone="blue" />
        <StatCard
          label="Sin profesional a cargo"
          value={formatNumber(unassigned.open)}
          hint={unassigned.open > 0 ? "Esperan que alguien los tome" : "Todos tienen a alguien"}
          icon={UserX}
          tone={unassigned.open > 0 ? "orange" : "green"}
        />
        <StatCard label="Urgentes" value={formatNumber(totals.urgent)} hint="Con prioridad urgente" icon={AlertTriangle} tone="red" />
        <StatCard label="Sin movimiento" value={formatNumber(totals.stale)} hint={`Sin intervenciones hace ${STALE_DAYS} días o más`} icon={Hourglass} tone="slate" />
      </StatRow>

      <Card className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-4">
        <h2 className="px-2 pb-2 pt-1 text-sm font-semibold text-foreground">Profesionales</h2>
        {rows.length === 0 ? (
          <EmptyMessage
            compact
            icon={UsersRound}
            title={`Todavía no hay profesionales en ${areaLabel}`}
            description="Cuando se carguen usuarios del área, aparecen acá con sus expedientes."
          />
        ) : (
          <>
          <MobileList label="Profesionales">
            {rows.map((r) => (
              <MobileListItem
                key={r.userId}
                href={casesHref({ assigned: r.userId })}
                leading={<InitialsAvatar name={r.name} seed={r.userId} size="sm" />}
                title={r.name}
                subtitle={`${plural(r.open, "sin cerrar", "sin cerrar")} · ${plural(r.urgent, "urgente")}`}
                meta={r.stale > 0 ? `${plural(r.stale, "sin movimiento", "sin movimiento")}` : !r.member ? "De otra área" : undefined}
              />
            ))}
          </MobileList>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/40 border-b border-border/60">
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Profesional</th>
                  <th className="h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Sin cerrar</th>
                  <th className="h-11 px-4 align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap text-right">Urgentes</th>
                  <th className="h-11 px-4 align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap text-right">Sin movimiento</th>
                  <th className="h-11 px-4 align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap text-right">Nuevos (7 días)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b border-border/50 transition-colors hover:bg-muted/60">
                    <td className="px-4 py-3 align-middle">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <InitialsAvatar name={r.name} seed={r.userId} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{r.name}</span>
                          {!r.member && <span className="block text-xs text-muted-foreground">De otra área</span>}
                          {r.member && r.role === "DIRECTOR_AREA" && <span className="block text-xs text-muted-foreground">Dirige el área</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="flex items-center gap-2.5">
                        <span className="w-8 text-right tabular-nums">{countLink(r.open, casesHref({ assigned: r.userId }))}</span>
                        <span aria-hidden className="h-2 w-28 overflow-hidden rounded bg-muted sm:w-40">
                          <span className="block h-full rounded bg-primary/70 dark:bg-blue-400/70" style={{ width: `${(r.open / maxOpen) * 100}%` }} />
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right tabular-nums">{countLink(r.urgent, casesHref({ assigned: r.userId, priority: "URGENTE" }))}</td>
                    <td className="px-4 py-3 align-middle text-right tabular-nums">{countLink(r.stale, casesHref({ assigned: r.userId, quiet: "1" }), true)}</td>
                    <td className="px-4 py-3 align-middle text-right tabular-nums">{r.recent === 0 ? <span className="text-muted-foreground">0</span> : formatNumber(r.recent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {suggested && (
          <p className="px-2 pt-3 text-xs text-muted-foreground">
            Con menos expedientes sin cerrar: <span className="font-semibold text-foreground">{suggested.name}</span> (
            {suggested.open === 0 ? "ninguno" : formatNumber(suggested.open)}). Es a quien se propone abajo para los que no tienen a nadie.
          </p>
        )}
      </Card>

      <Card className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 pb-2 pt-1">
          <h2 className="text-sm font-semibold text-foreground">Sin profesional a cargo ({formatNumber(unassigned.open)})</h2>
          {unassigned.open > unassignedCases.length && (
            <Link href={casesHref({ assigned: "none" })} className="text-xs font-semibold text-primary hover:underline">
              Ver los {formatNumber(unassigned.open)}
            </Link>
          )}
        </div>
        {unassignedCases.length === 0 ? (
          <EmptyMessage compact kind="done" icon={UserX} title="Todos los expedientes tienen a alguien a cargo" />
        ) : (
          <>
            <p className="px-2 pb-2 text-xs text-muted-foreground">
              Primero los urgentes y los más viejos{unassigned.open > UNASSIGNED_LIST_LIMIT ? `; se muestran los primeros ${UNASSIGNED_LIST_LIMIT}` : ""}. Al asignar, a la persona le llega un aviso.
            </p>
            <ul className="divide-y divide-border/30">
              {unassignedCases.map((c) => {
                const { tag, title } = splitCaseTitle(c.title);
                const label = c.titular || title;
                return (
                  <li key={c.id} className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/cases/${c.id}`} className="flex min-w-0 items-center gap-2 font-medium text-foreground hover:text-primary hover:underline">
                        <CaseTag tag={tag} />
                        <span className="truncate">{label}</span>
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {c.titular && <span className="truncate">{title}</span>}
                        {c.priority === "URGENTE" && <span className="font-semibold text-rose-700 dark:text-rose-400">Urgente</span>}
                        {c.priority === "ALTA" && <span className="font-semibold text-orange-700 dark:text-orange-300">Prioridad alta</span>}
                        <span>Abierto hace {plural(c.openDays, "día")}</span>
                        {c.quietDays >= STALE_DAYS && <span className="text-amber-700 dark:text-amber-400">{plural(c.quietDays, "día")} sin movimiento</span>}
                      </p>
                    </div>
                    <QuickAssign
                      caseId={c.id}
                      caseLabel={label}
                      suggested={suggested ? { id: suggested.userId, name: suggested.name, open: suggested.open } : null}
                      people={assignable
                        .filter((p) => p.userId !== suggested?.userId)
                        .map((p) => ({ id: p.userId, name: p.name, open: p.open }))}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
