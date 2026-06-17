export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { getHRRecords, getHRStats } from "@/services/hr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, UserPlus, Download, BarChart2,
  Plus, CheckCircle2, Calendar, Wallet, PieChart
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CreateHRForm } from "./create-hr-form";
import { AgentActionsMenu } from "./agent-actions-menu";
import { HRFilters } from "./hr-filters";

export default async function HRPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string, area?: string, status?: string }>
}) {
  const { q, area, status } = await searchParams;

  const records = await getHRRecords({ query: q, areaId: area, status });
  const stats = await getHRStats();
  const areasRaw = await prisma.area.findMany({
    orderBy: { name: 'asc' }
  });

  const sanitizedAreas = areasRaw.map(a => ({
    id: a.id,
    name: a.name,
    color: a.color
  }));

  const kpis = [
    { title: "Total Personal", value: stats.total, icon: Users, color: "text-blue-600", bg: "bg-blue-50", sub: "Agentes registrados" },
    { title: "Presupuesto Mensual", value: `$${stats.totalBudget.toLocaleString('es-AR')}`, icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50", sub: "Costo total de nómina" },
    { title: "Nuevos (Mes)", value: stats.newThisMonth, icon: UserPlus, color: "text-purple-600", bg: "bg-purple-50", sub: "Altas este período" },
    { title: "Áreas Cubiertas", value: stats.areaCount, icon: BarChart2, color: "text-amber-600", bg: "bg-amber-50", sub: "Distribución municipal" },
  ];

  const sanitizedRecords = records.map(r => ({
    ...r,
    salary: r.salary ? Number(r.salary) : 0,
    startDate: r.startDate ? r.startDate.toISOString() : null,
    statusUntil: r.statusUntil ? r.statusUntil.toISOString() : null,
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
          <h2 className="text-4xl font-black tracking-tight text-slate-900 uppercase tracking-tighter">Recursos Humanos</h2>
          <p className="text-muted-foreground text-lg font-medium italic">Gestión integral y control presupuestario de la nómina.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <Button variant="outline" className="rounded-xl h-11 px-4 gap-2 border-slate-200 hover:bg-slate-50 transition-all font-bold">
              <Download className="h-4 w-4" /> Exportar Planilla
           </Button>
           <Sheet>
              <SheetTrigger asChild>
                <Button className="rounded-xl h-11 px-6 gap-2 bg-[#004a80] hover:bg-[#00365d] text-white font-bold shadow-lg shadow-blue-900/20 transition-all hover:scale-105">
                    <Plus className="h-5 w-5" /> Nuevo Agente
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-xl w-full border-l border-border bg-background rounded-l-[2rem] shadow-2xl p-8 overflow-y-auto">
                <SheetHeader className="mb-8">
                  <SheetTitle className="text-2xl font-black">Registrar Nuevo Agente</SheetTitle>
                  <SheetDescription className="text-base font-medium">Complete los datos para crear el legajo municipal.</SheetDescription>
                </SheetHeader>
                <CreateHRForm areas={sanitizedAreas} />
              </SheetContent>
           </Sheet>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-none shadow-sm overflow-hidden bg-white rounded-3xl group transition-all hover:shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${kpi.bg} group-hover:scale-110 transition-transform`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tighter text-slate-900">{kpi.value}</p>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{kpi.title}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-4 font-medium italic">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Area Budget Summary - New Section */}
      <Card className="rounded-[2rem] border-none shadow-sm bg-slate-50/50">
        <CardContent className="p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <PieChart className="h-4 w-4" /> Distribución Salarial por Área
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {sanitizedAreas.map(area => {
                    const areaBudget = stats.budgetByArea[area.id] || 0;
                    return (
                        <div key={area.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <p className="text-[9px] font-black text-muted-foreground uppercase truncate mb-1" title={area.name}>{area.name}</p>
                            <p className="text-sm font-bold text-slate-900">${areaBudget.toLocaleString('es-AR')}</p>
                        </div>
                    )
                })}
            </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-xl">
        <HRFilters areas={sanitizedAreas} />

        <Table>
          <TableHeader className="bg-slate-50/50">
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
                  No se encontraron agentes con los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              sanitizedRecords.map((r) => (
                <TableRow key={r.id} className="group hover:bg-slate-50/30 transition-all border-none">
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-1 ring-slate-100">
                        <AvatarImage src={r.imageUrl || ""} alt={r.firstName} className="object-cover" />
                        <AvatarFallback className="bg-[#004a80] text-white font-black text-sm uppercase">
                          {r.firstName?.[0]}{r.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-black text-slate-800 group-hover:text-[#004a80] transition-colors">{r.firstName} {r.lastName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest flex items-center gap-2">
                           {r.fileNumber || 'S/L'} <span className="text-slate-200">•</span> DNI {r.dni}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm text-slate-700">{r.area?.name || "Sin Área"}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{r.position || "Sin Cargo"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                     <p className="text-xs font-bold text-slate-600 italic">
                        {r.startDate ? new Date(r.startDate).toLocaleDateString('es-AR') : '-'}
                     </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-black tracking-widest border-none w-fit ${
                        r.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600' :
                        r.status === 'LICENCIA' ? 'bg-amber-50 text-amber-600' :
                        r.status === 'VACACIONES' ? 'bg-blue-50 text-blue-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          r.status === 'ACTIVO' ? 'bg-emerald-600' :
                          r.status === 'LICENCIA' ? 'bg-amber-600' :
                          r.status === 'VACACIONES' ? 'bg-blue-600' :
                          'bg-rose-600'
                        }`} />
                        {r.status || 'ACTIVO'}
                      </Badge>
                      {r.statusUntil && (
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5 italic">
                           <Calendar className="h-2.5 w-2.5" /> Hasta {new Date(r.statusUntil).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <AgentActionsMenu agent={r} areas={sanitizedAreas} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="p-6 border-t border-slate-50 bg-slate-50/20 flex flex-col md:flex-row items-center justify-between gap-4">
           <p className="text-xs font-bold text-muted-foreground italic">Mostrando {sanitizedRecords.length} agentes municipales</p>
        </div>
      </div>
    </div>
  );
}
