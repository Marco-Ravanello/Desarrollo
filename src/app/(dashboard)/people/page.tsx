export const dynamic = "force-dynamic";

import { getPeople, getPeopleStats } from "@/services/people";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eye, Plus, Upload, Users, Calendar, Building2 } from "lucide-react";
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">Registro Único</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">Base de datos centralizada de ciudadanos y familias.</p>
        </div>

        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="rounded-2xl h-11 px-5 transition-all hover:bg-accent border-border/60">
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

          <Button asChild className="rounded-2xl h-11 px-5 shadow-lg shadow-primary/20 transition-all hover:scale-105 bg-primary text-primary-foreground font-bold">
            <Link href="/people/new"><Plus className="mr-2 h-4 w-4"/> Nueva Persona</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border border-blue-500/30 shadow-md bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-blue-100">Total Registrados</p>
            <div className="p-2 bg-white/10 rounded-xl">
              <Users className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="text-4xl font-black tabular-nums">{stats.total}</div>
          <p className="text-[11px] mt-2 text-blue-100/80 font-medium">Vecinos con legajo digital en sistema</p>
        </Card>

        <Card className="p-6 border border-border/60 shadow-sm bg-card text-card-foreground rounded-3xl">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Edad Promedio</p>
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-4xl font-black text-foreground tabular-nums">{stats.avgAge} <span className="text-xl font-normal text-muted-foreground">años</span></div>
          <p className="text-[11px] mt-2 text-muted-foreground font-medium">Datos calculados según fecha de nacimiento</p>
        </Card>

        <Card className="p-6 border border-border/60 shadow-sm bg-card text-card-foreground rounded-3xl">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Área más Activa</p>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground line-clamp-1">{stats.topArea || "Sin registros"}</div>
          <p className="text-[11px] mt-2 text-muted-foreground font-medium">Mayor volumen de casos atendidos</p>
        </Card>
      </div>

      <Card className="border border-border/60 shadow-sm overflow-hidden rounded-3xl bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Apellido y Nombre</TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">DNI</TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Casos</TableHead>
                <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {people.map(p => (
                <TableRow key={p.id} className="group transition-colors hover:bg-muted/30">
                  <TableCell className="font-bold text-sm text-foreground py-4 px-6">{p.lastName}, {p.firstName}</TableCell>
                  <TableCell className="text-muted-foreground font-medium text-xs py-4 px-6 tabular-nums">{p.dni}</TableCell>
                  <TableCell className="py-4 px-6">
                    <Badge variant="secondary" className="rounded-xl font-bold bg-primary/10 text-primary border-none text-xs px-2.5 py-0.5">
                      {p._count.cases} Casos
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-4 px-6">
                    <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-primary hover:text-white transition-all h-9 w-9">
                      <Link href={`/people/${p.id}`}><Eye className="h-4 w-4"/></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
