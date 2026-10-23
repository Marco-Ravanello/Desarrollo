export const dynamic = "force-dynamic";

import { getPaginatedPeople, getPeopleFilterOptions, getPeopleStats } from "@/services/people";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eye, Plus, Upload, Users, Calendar, Building2, MapPin, Phone, RotateCcw, UserX, CopyCheck } from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
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
import { plural } from "@/lib/formato";
import { barrioLabel } from "@/lib/person-display";

export const metadata = { title: "Registro Único" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    barrio?: string;
    programa?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const { search, barrio, programa, page, limit } = await searchParams;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

  const [paginatedData, filterOptions, stats, session] = await Promise.all([
    getPaginatedPeople({
      query: search,
      barrio,
      programa,
      page: pageNum,
      limit: limitNum
    }),
    getPeopleFilterOptions(),
    getPeopleStats(),
    auth()
  ]);
  // Importar personas e intervenciones es solo para la conducción.
  const canImport = Boolean(session?.user && MANAGEMENT_ROLES.includes(session.user.role));

  const { people, total, totalPages, currentPage, pageSize } = paginatedData;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
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
                    <TabsTrigger value="padron" className="flex-1">Personas al padrón</TabsTrigger>
                    <TabsTrigger value="intervenciones" className="flex-1">Intervenciones</TabsTrigger>
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

      {/* KPI Cards */}
      <StatRow className="lg:grid-cols-3">
        <StatCard
          label="Padrón unificado"
          value={stats.total.toLocaleString("es-AR")}
          hint="Personas con datos de los programas sociales"
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Edad promedio"
          value={
            stats.avgAge > 0 ? (
              <>
                {stats.avgAge} <span className="text-xl font-normal text-muted-foreground">años</span>
              </>
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">S/D</span>
            )
          }
          hint="Promedio etario de titulares y beneficiarios"
          icon={Calendar}
          tone="purple"
        />
        <StatCard
          className="sm:col-span-2 lg:col-span-1"
          label="Barrio con mayor asistencia"
          value={
            <span className="line-clamp-1 text-xl" title={stats.topArea}>
              {stats.topArea && stats.topArea !== "Tres de Febrero" && stats.topArea !== "Sin datos" ? stats.topArea : "Sin registros"}
            </span>
          }
          hint="Zona de mayor concentración de prestaciones"
          icon={Building2}
          tone="orange"
        />
      </StatRow>

      {/* Componente de Filtros Avanzados */}
      <PeopleFilters
        barrios={filterOptions.barrios}
        programas={filterOptions.programas}
      />

      {/* Tabla de Ciudadanos */}
      <Card className="border border-border/60 shadow-sm overflow-hidden rounded-2xl bg-card p-0 md:p-4 space-y-4">
          {people.length > 0 && (
            <MobileList label="Personas">
              {people.map((p: any) => (
                <MobileListItem
                  key={p.id}
                  href={`/people/${p.id}`}
                  title={`${p.lastName}, ${p.firstName}`}
                  subtitle={[`DNI ${p.dni}`, p.barrio ? barrioLabel(p.barrio) : p.address].filter(Boolean).join(" · ")}
                  meta={
                    p.programasActivos?.length
                      ? p.programasActivos.slice(0, 2).join(", ") + (p.programasActivos.length > 2 ? ` y ${p.programasActivos.length - 2} más` : "")
                      : undefined
                  }
                />
              ))}
            </MobileList>
          )}
          <div className={people.length > 0 ? "hidden md:block" : undefined}>
          <Table mobileCards={false}>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="font-bold text-muted-foreground text-xs py-4 px-6">
                  Apellido y nombre
                </TableHead>
                <TableHead className="font-bold text-muted-foreground text-xs py-4 px-6">
                  DNI
                </TableHead>
                <TableHead className="font-bold text-muted-foreground text-xs py-4 px-6">
                  Programas sociales activos
                </TableHead>
                <TableHead className="font-bold text-muted-foreground text-xs py-4 px-6">
                  Barrio / domicilio
                </TableHead>
                <TableHead className="font-bold text-muted-foreground text-xs py-4 px-6">
                  Contacto
                </TableHead>
                <TableHead className="font-bold text-muted-foreground text-xs py-4 px-6 text-right">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {people.length > 0 ? (
                people.map((p: any) => (
                  <TableRow key={p.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="font-bold text-sm text-foreground py-4 px-6">
                      <Link href={`/people/${p.id}`} className="hover:text-primary transition-colors flex items-center gap-1.5">
                        <span>{p.lastName}, {p.firstName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono font-semibold text-xs py-4 px-6 tabular-nums">
                      {p.dni}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 items-center max-w-[280px]">
                        {p.programasActivos && p.programasActivos.length > 0 ? (
                          <>
                            {p.programasActivos.slice(0, 2).map((prog: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs font-bold border-primary/30 text-primary bg-primary/5 py-0 px-2 rounded-lg">
                                {prog}
                              </Badge>
                            ))}
                            {p.programasActivos.length > 2 && (
                              <Badge variant="secondary" className="text-xs font-bold py-0 px-1.5 rounded-lg bg-muted text-muted-foreground">
                                +{p.programasActivos.length - 2} más
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="secondary" className="rounded-xl font-bold bg-muted text-muted-foreground text-xs px-2 py-0.5">
                            {plural(p.casesCount || 0, "expediente")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-4 px-6 max-w-[220px] truncate">
                      <span className="flex items-center gap-1.5" title={p.address || "Sin dirección"}>
                        <MapPin className="h-3 w-3 text-primary/70 shrink-0" />
                        <span className="truncate">{p.barrio ? barrioLabel(p.barrio) : (p.address || "Sin dirección")}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-4 px-6">
                      {p.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="font-mono">{p.phone}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">No registra</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="sm" asChild className="rounded-xl h-8 px-2.5 text-xs font-bold hover:bg-primary hover:text-white transition-all text-primary gap-1">
                          <Link href={`/people/${p.id}`}>
                            <Eye className="h-3.5 w-3.5"/>
                            <span>Ver ficha</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyMessage
                      kind={search || barrio || programa ? "search" : "empty"}
                      title={search || barrio || programa ? "Nadie del padrón coincide con la búsqueda" : "Todavía no hay personas en el padrón"}
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
        <PeoplePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
        />
      </Card>
    </div>
  );
}
