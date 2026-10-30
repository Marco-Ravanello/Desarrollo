export const dynamic = "force-dynamic";

import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { PADRON_GAPS, isPadronGap } from "@/lib/padron-quality";
import { getPaginatedPeople, getPeopleFilterOptions, getPeopleStats } from "@/services/people";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Upload, Users, Calendar, Building2, MapPin, Phone, RotateCcw, UserX, CopyCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import InterventionsAdminPage from "../../admin/interventions/page";
import { PadronImport } from "@/components/people/padron-import";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/auth";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { PeopleFilters } from "@/components/people/people-filters";
import { PeoplePagination } from "@/components/people/people-pagination";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { MobileList, MobileListItem, StatRow } from "@/components/ui/mobile-list";
import { EmptyMessage } from "@/components/ui/empty-message";
import { PeopleHeaderActions } from "@/components/people/people-header-actions";
import { formatNumber, plural } from "@/lib/formato";
import { barrioLabel, programChips } from "@/lib/person-display";

export const metadata = { title: "Registro Único" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    barrio?: string;
    programa?: string;
    falta?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const { search, barrio, programa, page, limit, falta: faltaRaw } = await searchParams;
  const falta = isPadronGap(faltaRaw) ? faltaRaw : undefined;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

  const [paginatedData, filterOptions, stats, session] = await Promise.all([
    getPaginatedPeople({
      query: search,
      barrio,
      programa,
      falta,
      page: pageNum,
      limit: limitNum,
    }),
    getPeopleFilterOptions(),
    getPeopleStats(),
    auth(),
  ]);
  // Importar personas e intervenciones es solo para la conducción.
  const canImport = Boolean(session?.user && MANAGEMENT_ROLES.includes(session.user.role));

  const { people, total, totalPages, currentPage, pageSize } = paginatedData;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro Único"
        description="Las personas del padrón municipal. Buscá por nombre, DNI o dirección y entrá a su ficha."
        icon={Users}
        actions={
          <PeopleHeaderActions
            canImport={canImport}
            importContent={
              canImport ? (
                <Tabs defaultValue="padron">
                  <TabsList className="mb-6 w-full">
                    <TabsTrigger value="padron" className="flex-1">
                      Personas al padrón
                    </TabsTrigger>
                    <TabsTrigger value="intervenciones" className="flex-1">
                      Intervenciones
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="padron">
                    <PadronImport />
                  </TabsContent>
                  <TabsContent value="intervenciones">
                    <InterventionsAdminPage />
                  </TabsContent>
                </Tabs>
              ) : undefined
            }
          />
        }
      />

      <StatRow className="lg:grid-cols-3">
        <StatCard label="Personas en el padrón" value={formatNumber(stats.total)} hint="Todas las cargadas en el Registro Único" icon={Users} tone="blue" />
        <StatCard
          label="Edad promedio"
          value={stats.avgAge > 0 ? `${stats.avgAge} años` : "Sin datos"}
          hint={stats.avgAge > 0 ? "De quienes tienen la edad o la fecha de nacimiento" : "Falta cargar fechas de nacimiento"}
          icon={Calendar}
          tone="purple"
        />
        <StatCard
          className="sm:col-span-2 lg:col-span-1"
          label="Barrio con más personas"
          value={
            <span className="line-clamp-1 text-xl" title={stats.topArea}>
              {stats.topArea && stats.topArea !== "Tres de Febrero" && stats.topArea !== "Sin datos" ? stats.topArea : "Sin datos"}
            </span>
          }
          hint={stats.topArea && stats.topArea !== "Tres de Febrero" && stats.topArea !== "Sin datos" && stats.topAreaCount > 0 ? plural(stats.topAreaCount, "persona") : "Falta cargar el barrio"}
          icon={Building2}
          tone="orange"
        />
      </StatRow>

      {/* Componente de Filtros Avanzados */}
      <PeopleFilters barrios={filterOptions.barrios} programas={filterOptions.programas} />

      {falta && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-4 py-2.5 text-xs">
          <span className="font-bold text-foreground">Mostrando: {PADRON_GAPS[falta].label.toLowerCase()}</span>
          <span className="text-muted-foreground">({plural(total, "persona")})</span>
          <Link href="/people/calidad" className="font-semibold text-primary hover:underline">
            Volver a la calidad de datos
          </Link>
          <Link href="/people" className="ml-auto font-semibold text-muted-foreground hover:text-foreground">
            Quitar este filtro
          </Link>
        </div>
      )}

      {/* Tabla de Ciudadanos */}
      <Card className="border border-border/60 shadow-sm overflow-hidden rounded-2xl bg-card p-0 md:p-4 space-y-4">
        {people.length > 0 && (
          <MobileList label="Personas">
            {people.map((p: any) => (
              <MobileListItem
                key={p.id}
                href={`/people/${p.id}`}
                title={`${p.lastName}, ${p.firstName}`}
                leading={<InitialsAvatar name={p.firstName} lastName={p.lastName} seed={p.dni} />}
                subtitle={[`DNI ${p.dni}`, p.barrio ? barrioLabel(p.barrio) : p.address].filter(Boolean).join(" · ")}
                meta={
                  p.programasActivos?.length
                    ? p.programasActivos.slice(0, 2).join(", ") +
                      (p.programasActivos.length > 2 ? ` y ${p.programasActivos.length - 2} más` : "")
                    : undefined
                }
              />
            ))}
          </MobileList>
        )}
        <div className={people.length > 0 ? "hidden md:block" : undefined}>
          <Table mobileCards={false}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Programas activos</TableHead>
                <TableHead>Barrio</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.length > 0 ? (
                people.map((p: any) => {
                  const chips = programChips(p.programasActivos);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-semibold text-foreground">
                        <Link href={`/people/${p.id}`} className="flex items-center gap-2.5 hover:text-primary">
                          <InitialsAvatar name={p.firstName} lastName={p.lastName} seed={p.dni} size="sm" />
                          <span>
                            {p.lastName}, {p.firstName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">{p.dni}</TableCell>
                      <TableCell>
                        {chips.shown.length > 0 ? (
                          <div className="flex max-w-[18rem] items-center gap-1" title={p.programasActivos.join(", ")}>
                            {chips.shown.map((prog) => (
                              <Badge
                                key={prog}
                                variant="outline"
                                className="min-w-0 max-w-[12rem] shrink whitespace-nowrap rounded-md border-primary/25 bg-primary/5 px-1.5 py-0 text-xs font-semibold text-primary"
                              >
                                <span className="truncate">{prog}</span>
                              </Badge>
                            ))}
                            {chips.rest > 0 && (
                              <span className="shrink-0 rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
                                +{chips.rest}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin programas</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[14rem] text-sm text-muted-foreground">
                        <span className="block truncate" title={p.address || undefined}>
                          {p.barrio ? barrioLabel(p.barrio) : p.address || "Sin dirección"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                        {p.phone || <span className="text-xs">Sin teléfono</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Button variant="ghost" size="sm" asChild className="h-8 gap-1 px-2.5 text-xs font-semibold text-primary">
                          <Link href={`/people/${p.id}`}>
                            Ver ficha <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyMessage
                      kind={search || barrio || programa ? "search" : "empty"}
                      title={
                        search || barrio || programa ? "Nadie del padrón coincide con la búsqueda" : "Todavía no hay personas en el padrón"
                      }
                      description={
                        search || barrio || programa
                          ? "Probá con otro nombre o DNI, o quitá los filtros de barrio y programa."
                          : "Cuando se importe la planilla del padrón, las personas aparecen acá."
                      }
                      icon={UserX}
                      action={
                        <Button variant="outline" asChild className="rounded-2xl text-xs font-bold gap-2 border-border/60">
                          <Link href="/people">
                            <RotateCcw className="h-3.5 w-3.5 text-primary" />
                            Quitar filtros
                          </Link>
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Componente de Paginación Server-Side */}
        <PeoplePagination currentPage={currentPage} totalPages={totalPages} totalItems={total} pageSize={pageSize} />
      </Card>
    </div>
  );
}
