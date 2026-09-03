export const dynamic = "force-dynamic";

import { getPeople, getPeopleStats } from "@/services/people";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eye, Plus, Upload, Users, Calendar, Building2, Search, MapPin, Phone, Network } from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import InterventionsAdminPage from "../admin/interventions/page";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const [people, stats] = await Promise.all([
    getPeople(search),
    getPeopleStats()
  ]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">Registro Único</h2>
            <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
              Padrón 360°
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Padrón centralizado de ciudadanos, familias y asistencia municipal unificada de Tres de Febrero.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild className="rounded-2xl h-11 px-4 text-xs font-bold transition-all hover:bg-accent border-border/60 gap-2">
            <Link href="/ficha-social">
              <Network className="h-4 w-4 text-indigo-500" />
              Buscador Ficha 360°
            </Link>
          </Button>
          <Button variant="outline" asChild className="rounded-2xl h-11 px-4 text-xs font-bold transition-all hover:bg-accent border-border/60 gap-2">
            <Link href="/ficha-social/cruces">
              Matriz de Cruces
            </Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="rounded-2xl h-11 px-4 text-xs font-bold transition-all hover:bg-accent border-border/60">
                <Upload className="mr-2 h-4 w-4"/> Importar
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-xl w-full bg-card text-card-foreground rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto border-l border-border">
              <SheetHeader className="mb-8">
                <SheetTitle className="text-2xl font-black">Importación Masiva</SheetTitle>
                <SheetDescription>Suba su archivo Excel para migrar intervenciones y ciudadanos.</SheetDescription>
              </SheetHeader>
              <InterventionsAdminPage />
            </SheetContent>
          </Sheet>
          <Button asChild className="rounded-2xl h-11 px-5 shadow-lg shadow-primary/20 transition-all hover:scale-105 bg-primary text-primary-foreground font-bold text-xs">
            <Link href="/people/new"><Plus className="mr-2 h-4 w-4"/> Nueva Persona</Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border border-blue-500/30 shadow-md bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-blue-100">Padrón Unificado</p>
            <div className="p-2 bg-white/10 rounded-xl">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="text-4xl font-black tabular-nums">{stats.total.toLocaleString("es-AR")}</div>
          <p className="text-[11px] mt-2 text-blue-100/80 font-medium">Ciudadanos unificados con cruce de programas</p>
        </Card>

        <Card className="p-6 border border-border/60 shadow-sm bg-card text-card-foreground rounded-3xl">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Edad Promedio</p>
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-4xl font-black text-foreground tabular-nums">{stats.avgAge} <span className="text-xl font-normal text-muted-foreground">años</span></div>
          <p className="text-[11px] mt-2 text-muted-foreground font-medium">Promedio etario de titulares y beneficiarios</p>
        </Card>

        <Card className="p-6 border border-border/60 shadow-sm bg-card text-card-foreground rounded-3xl">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Barrio con Mayor Asistencia</p>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground line-clamp-1">{stats.topArea || "Sin registros"}</div>
          <p className="text-[11px] mt-2 text-muted-foreground font-medium">Zona de mayor concentración de prestaciones</p>
        </Card>
      </div>

      {/* Buscador de Padrón */}
      <Card className="p-4 bg-card border border-border/60 rounded-3xl shadow-xs">
        <form method="get" className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              defaultValue={search || ""}
              placeholder="Buscar por DNI, Apellido, Nombre o Barrio (Ej: 34438385 o Iribarren o Ejército de los Andes)..."
              className="pl-10 h-11 rounded-2xl border-border/60 bg-muted/20 text-xs font-semibold"
            />
          </div>
          <Button type="submit" className="h-11 rounded-2xl px-5 text-xs font-bold gap-2 bg-primary text-primary-foreground">
            <Search className="h-4 w-4" />
            <span>Buscar en Padrón</span>
          </Button>
          {search && (
            <Button variant="ghost" asChild className="h-11 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground">
              <Link href="/people">Limpiar</Link>
            </Button>
          )}
        </form>
      </Card>

      {/* Tabla de Ciudadanos */}
      <Card className="border border-border/60 shadow-sm overflow-hidden rounded-3xl bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">
                  Apellido y Nombre
                </TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">
                  DNI
                </TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">
                  Programas Sociales Activos
                </TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">
                  Barrio / Domicilio
                </TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">
                  Contacto
                </TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6 text-right">
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
                              <Badge key={idx} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5 py-0 px-2 rounded-lg">
                                {prog}
                              </Badge>
                            ))}
                            {p.programasActivos.length > 2 && (
                              <Badge variant="secondary" className="text-[9px] font-bold py-0 px-1.5 rounded-lg bg-muted text-muted-foreground">
                                +{p.programasActivos.length - 2} más
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="secondary" className="rounded-xl font-bold bg-muted text-muted-foreground text-xs px-2 py-0.5">
                            {p.casesCount || 0} Casos
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-4 px-6 max-w-[220px] truncate">
                      <span className="flex items-center gap-1.5" title={p.address || "Sin dirección"}>
                        <MapPin className="h-3 w-3 text-primary/70 shrink-0" />
                        <span className="truncate">{p.barrio ? `Barrio ${p.barrio}` : (p.address || "Sin dirección")}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-4 px-6">
                      {p.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="font-mono">{p.phone}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 italic">No registra</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="sm" asChild className="rounded-xl h-8 px-2.5 text-[11px] font-bold hover:bg-primary hover:text-white transition-all text-primary gap-1">
                          <Link href={`/people/${p.id}`} title="Ver expediente">
                            <Eye className="h-3.5 w-3.5"/>
                            <span>Expediente</span>
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="rounded-xl h-8 px-2.5 text-[11px] font-bold hover:bg-indigo-600 hover:text-white transition-all text-indigo-500 gap-1">
                          <Link href={`/ficha-social`} title="Ver Ficha 360°">
                            <Network className="h-3.5 w-3.5"/>
                            <span>360°</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground italic text-xs">
                    No se encontraron ciudadanos que coincidan con la búsqueda.
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
