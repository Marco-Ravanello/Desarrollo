export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { getHRRecords, getHRStats } from "@/services/hr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, UserPlus, Search, Filter,
  MoreHorizontal, Download, BarChart2,
  Plus, Eye, CheckCircle2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CreateHRForm } from "./create-hr-form";
import { ViewHRDetail } from "./view-hr-detail";
import { DeleteHRAction, EditHRAction } from "./actions-client";

export default async function HRPage() {
  const records = await getHRRecords();
  const stats = await getHRStats();
  const areasRaw = await prisma.area.findMany({
    orderBy: { name: 'asc' }
  });

  // Sanitize areas for client components (Prisma Decimals are not serializable)
  const sanitizedAreas = areasRaw.map(a => ({
    id: a.id,
    name: a.name,
    color: a.color
  }));

  const kpis = [
    { title: "Total Personal", value: stats.total, icon: Users, color: "text-blue-600", bg: "bg-blue-50", sub: "Agentes registrados" },
    { title: "Personal Activo", value: stats.active, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", sub: `${Math.round((stats.active/(stats.total || 1))*100)}% de la nómina` },
    { title: "Nuevos (Mes)", value: stats.newThisMonth, icon: UserPlus, color: "text-purple-600", bg: "bg-purple-50", sub: "Altas este período" },
    { title: "Áreas Cubiertas", value: stats.areaCount, icon: BarChart2, color: "text-amber-600", bg: "bg-amber-50", sub: "Distribución municipal" },
  ];

  // Sanitize records for client components (Convert Decimals to Numbers and Dates to Strings)
  const sanitizedRecords = records.map(r => ({
    ...r,
    salary: r.salary ? Number(r.salary) : 0,
    startDate: r.startDate ? r.startDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    area: r.area ? {
      id: r.area.id,
      name: r.area.name,
      color: r.area.color
    } : null
  }));

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Recursos Humanos</h2>
          <p className="text-muted-foreground text-lg font-medium">Gestión integral de la nómina y legajos municipales.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <Button variant="outline" className="rounded-xl h-11 px-4 gap-2 border-slate-200 hover:bg-slate-50 transition-all font-bold">
              <Download className="h-4 w-4" /> Exportar
           </Button>
           <Sheet>
              <SheetTrigger asChild>
                <Button className="rounded-xl h-11 px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 transition-all hover:scale-105">
                    <Plus className="h-5 w-5" /> Nuevo Agente
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-md w-full border-l border-border bg-background rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto">
                <SheetHeader className="mb-8">
                  <SheetTitle className="text-2xl font-black">Nuevo Agente</SheetTitle>
                  <SheetDescription className="text-base">Complete los datos para crear el legajo municipal.</SheetDescription>
                </SheetHeader>
                <CreateHRForm areas={sanitizedAreas} />
              </SheetContent>
           </Sheet>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm rounded-3xl group transition-all hover:shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${kpi.bg} group-hover:scale-110 transition-transform`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tighter">{kpi.value}</p>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{kpi.title}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-4 font-medium italic">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-card/50 backdrop-blur-sm rounded-[2rem] border border-border/50 shadow-sm overflow-hidden transition-all hover:shadow-xl">
        <div className="p-6 border-b border-border/50 flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar agente por nombre, DNI o legajo..."
                className="pl-11 h-12 rounded-2xl bg-muted/50 border-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
              />
           </div>
           <div className="flex items-center gap-3 w-full md:w-auto">
              <Button variant="ghost" className="rounded-xl h-12 px-4 gap-2 font-bold text-muted-foreground">
                 Todas las áreas <Filter className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="secondary" className="rounded-xl h-12 w-12 text-muted-foreground">
                 <Filter className="h-5 w-5" />
              </Button>
           </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="font-bold py-5 px-6">Agente</TableHead>
              <TableHead className="font-bold">Área / Cargo</TableHead>
              <TableHead className="font-bold">Ingreso</TableHead>
              <TableHead className="font-bold">Estado</TableHead>
              <TableHead className="font-bold text-right pr-8">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sanitizedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic font-medium">
                  No hay agentes registrados en la nómina municipal.
                </TableCell>
              </TableRow>
            ) : (
              sanitizedRecords.map((r) => (
                <TableRow key={r.id} className="group hover:bg-muted/20 transition-all border-none">
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-xs uppercase">
                          {r.firstName?.[0] || '?'}{r.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-black text-foreground group-hover:text-primary transition-colors">{r.firstName} {r.lastName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest flex items-center gap-2">
                           DNI {r.dni} <span className="text-slate-300">•</span> Leg. {r.fileNumber || '0000'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm">{r.area?.name || "Sin Área"}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{r.position || "Sin Cargo"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                     <p className="text-xs font-bold text-slate-600 italic">
                        {r.startDate ? new Date(r.startDate).toLocaleDateString('es-AR') : '-'}
                     </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-black tracking-widest border-none ${
                      r.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600' :
                      r.status === 'LICENCIA' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        r.status === 'ACTIVO' ? 'bg-emerald-600' :
                        r.status === 'LICENCIA' ? 'bg-amber-600' : 'bg-rose-600'
                      }`} />
                      {r.status || 'ACTIVO'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <Sheet>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary hover:text-white transition-all">
                             <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-border/50">
                          <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Opciones de Legajo</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-border/50" />
                          <SheetTrigger asChild>
                            <DropdownMenuItem
                              className="rounded-xl px-3 py-2.5 gap-3 font-bold focus:bg-primary focus:text-white transition-all cursor-pointer"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Eye className="h-4 w-4" /> Ver Detalles
                            </DropdownMenuItem>
                          </SheetTrigger>
                          <EditHRAction />
                          <DropdownMenuSeparator className="bg-border/50" />
                          <DeleteHRAction agentId={r.id} />
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <SheetContent side="right" className="sm:max-w-lg w-full border-l border-border bg-background rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto">
                        <SheetHeader className="mb-8">
                          <SheetTitle className="text-2xl font-black">Detalle del Agente</SheetTitle>
                          <SheetDescription className="text-base">Información completa y situación de revista.</SheetDescription>
                        </SheetHeader>
                        <ViewHRDetail agent={r} />
                      </SheetContent>
                    </Sheet>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="p-6 border-t border-border/50 bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-4">
           <p className="text-xs font-bold text-muted-foreground italic">Mostrando {sanitizedRecords.length} agentes</p>
        </div>
      </div>
    </div>
  );
}
