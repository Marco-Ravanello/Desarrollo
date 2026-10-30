export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { MobileFilters } from "@/components/ui/mobile-filters";
import { FilterForm } from "@/components/ui/filter-form";
import { ActiveFilters } from "@/components/ui/active-filters";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { ScrollText, Search, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { formatFechaHora } from "@/lib/fechas";
import { formatNumber, plural } from "@/lib/formato";
import { AUDIT_GROUPS, auditEntityLabel, auditLink, describeAuditAction, formatAuditDetails } from "@/lib/audit-labels";
import { AUDIT_PAGE_SIZE, getAuditPeople, parseAuditFilters, searchAuditLogs, type AuditRow } from "@/services/audit";
import { ExportAuditButton } from "./export-audit-button";
import { getAreaShortName } from "@/lib/area-theme";

export const metadata = { title: "Auditoría" };

type Params = { persona?: string; tipo?: string; desde?: string; hasta?: string; q?: string; ingresos?: string; pagina?: string };

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/60 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

function personName(u: { name: string | null; username: string | null; email: string | null }) {
  return u.name || u.username || u.email || "Usuario";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role as any, PERMISSIONS.VIEW_AUDIT_LOGS)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const page = Math.max(1, Number(params.pagina) || 1);
  const [{ rows, total }, people] = await Promise.all([searchAuditLogs(filters, page), getAuditPeople()]);

  // Lo que se manda al cambiar de página o al descargar: los mismos filtros.
  const filterParams: Record<string, string | undefined> = {
    persona: filters.userId,
    tipo: filters.group,
    desde: filters.from,
    hasta: filters.to,
    q: filters.q,
    ingresos: filters.includeLogins ? "1" : undefined,
  };
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(filterParams)) if (v) sp.set(k, v);
    if (n > 1) sp.set("pagina", String(n));
    const qs = sp.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  const activeFilters = [filters.userId, filters.group, filters.from, filters.to, filters.includeLogins].filter(Boolean).length;
  const anyFilter = activeFilters > 0 || Boolean(filters.q);
  const first = total === 0 ? 0 : (page - 1) * AUDIT_PAGE_SIZE + 1;
  const last = Math.min(total, page * AUDIT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué en la app, y cuándo. Buscá por persona, tipo de movimiento, fechas, DNI o expediente."
        icon={ScrollText}
        actions={<ExportAuditButton params={filterParams} disabled={total === 0} />}
      />

      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
        <FilterForm className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <div className="relative sm:col-span-2 lg:col-span-5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={filters.q || ""}
              aria-label="Buscar en la Auditoría"
              placeholder="DNI, carátula del expediente o texto del detalle"
              className="h-10 rounded-xl border-border/60 bg-muted/30 pl-9 text-xs"
            />
          </div>
          <Button type="submit" size="sm" className="h-10 rounded-xl text-xs font-bold sm:col-span-2 lg:col-span-1 sm:order-last lg:order-none">
            Buscar
          </Button>
          <MobileFilters active={activeFilters}>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Quién</span>
              <select name="persona" defaultValue={filters.userId || "all"} className={selectClass}>
                <option value="all">Todas las personas</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{personName(p)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Qué</span>
              <select name="tipo" defaultValue={filters.group || "all"} className={selectClass}>
                <option value="all">Todos los movimientos</option>
                {AUDIT_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Desde</span>
              <Input type="date" name="desde" defaultValue={filters.from || ""} className="h-10 rounded-xl border-border/60 bg-muted/30 text-xs" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Hasta</span>
              <Input type="date" name="hasta" defaultValue={filters.to || ""} className="h-10 rounded-xl border-border/60 bg-muted/30 text-xs" />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-6">
              <input type="checkbox" name="ingresos" value="1" defaultChecked={filters.includeLogins} className="h-4 w-4 rounded border-border" />
              Mostrar también los ingresos a la app
            </label>
          </MobileFilters>
        </FilterForm>
        <ActiveFilters
          clearHref="/admin/audit"
          items={[
            filters.q && `Texto: ${filters.q}`,
            filters.userId && `Quién: ${personName(people.find((p) => p.id === filters.userId) ?? { name: null, username: null, email: null })}`,
            filters.group && AUDIT_GROUPS.find((g) => g.id === filters.group)?.label,
            filters.from && `Desde: ${filters.from.split("-").reverse().join("/")}`,
            filters.to && `Hasta: ${filters.to.split("-").reverse().join("/")}`,
            filters.includeLogins && "Con ingresos",
          ]}
        />
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-xs">
        {rows.length === 0 ? (
          <EmptyMessage
            kind={anyFilter ? "search" : "empty"}
            title={anyFilter ? "Ningún movimiento coincide con la búsqueda" : "Todavía no hay movimientos registrados"}
            description={anyFilter ? "Probá con otras fechas o quitá algunos filtros." : "Cada acción importante en la app queda anotada acá."}
            action={
              anyFilter ? (
                <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                  <Link href="/admin/audit">Quitar filtros</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="border-b border-border/40 px-4 py-3 text-xs text-muted-foreground">
              {total <= AUDIT_PAGE_SIZE
                ? plural(total, "movimiento")
                : `Del ${formatNumber(first)} al ${formatNumber(last)} de ${plural(total, "movimiento")}, del más nuevo al más viejo`}
            </div>
            <MobileList label="Movimientos">
              {rows.map((log) => (
                <AuditMobileRow key={log.id} log={log} />
              ))}
            </MobileList>
            <div className="hidden md:block">
              <Table mobileCards={false} className="table-fixed">
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead className="w-36">Fecha y hora</TableHead>
                    <TableHead className="w-48">Quién</TableHead>
                    <TableHead>Qué hizo</TableHead>
                    <TableHead className="w-36">Sobre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/30">
                  {rows.map((log) => {
                    const { label } = describeAuditAction(log.action, log.entity);
                    const details = formatAuditDetails(log.details);
                    const href = auditLink(log);
                    return (
                      <TableRow key={log.id} className="align-top">
                        <TableCell className="whitespace-nowrap pt-3 font-mono text-xs text-muted-foreground">{formatFechaHora(log.createdAt)}</TableCell>
                        <TableCell className="pt-3">
                          <div className="truncate text-xs font-semibold text-foreground" title={personName(log.user)}>{personName(log.user)}</div>
                          <div className="truncate text-xs text-muted-foreground" title={log.user.area?.name}>{log.user.area ? getAreaShortName(log.user.area.name) : "Sin área"}</div>
                        </TableCell>
                        <TableCell className="pt-3">
                          <div className="text-sm font-medium text-foreground">{label}</div>
                          {details && (
                            <p className="mt-0.5 line-clamp-3 whitespace-pre-line break-words text-xs text-muted-foreground" title={details}>
                              {details}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="pt-3">
                          {href ? (
                            <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              {auditEntityLabel(log.entity)} <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">{auditEntityLabel(log.entity)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <nav aria-label="Páginas" className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-3">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                    <Link href={pageHref(page - 1)}><ChevronLeft className="h-4 w-4" /> Más nuevos</Link>
                  </Button>
                ) : <span />}
                <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
                {page < totalPages ? (
                  <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                    <Link href={pageHref(page + 1)}>Ver más viejos <ChevronRight className="h-4 w-4" /></Link>
                  </Button>
                ) : <span />}
              </nav>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function AuditMobileRow({ log }: { log: AuditRow }) {
  const { label } = describeAuditAction(log.action, log.entity);
  const details = formatAuditDetails(log.details);
  return (
    <MobileListItem
      href={auditLink(log) ?? undefined}
      title={label}
      subtitle={`${personName(log.user)} · ${formatFechaHora(log.createdAt)}`}
      meta={details || undefined}
    />
  );
}
