export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllCases, getAreas } from "@/services/cases";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBreadcrumbs } from "@/components/layout/breadcrumbs-context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  FileText, ShieldAlert, CheckCircle2, Clock, Plus, Search,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

interface CasesPageProps {
  searchParams: Promise<{
    q?: string;
    area?: string;
    status?: string;
    priority?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q, area, status, priority, page, limit } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));

  const [data, areasList] = await Promise.all([
    getAllCases({
      query: q,
      areaId: area,
      status,
      priority,
      page: pageNum,
      limit: limitNum,
    }),
    getAreas(),
  ]);

  const canViewSensitive = hasPermission(session.user.role as any, PERMISSIONS.VIEW_SENSITIVE_CASES);

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENTE":
        return <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30 text-[10px] font-black">URGENTE</Badge>;
      case "ALTA":
        return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px] font-bold">ALTA</Badge>;
      case "MEDIA":
        return <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-[10px] font-medium">MEDIA</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-400 text-[10px]">BAJA</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "ABIERTO":
        return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] font-bold">ABIERTO</Badge>;
      case "EN_PROCESO":
        return <Badge className="bg-sky-500/15 text-sky-500 border-sky-500/30 text-[10px] font-bold">EN PROCESO</Badge>;
      case "CERRADO":
        return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 text-[10px] font-medium">RESUELTO</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{s}</Badge>;
    }
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Expedientes y Casos", active: true }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <PageBreadcrumbs items={breadcrumbs} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Expedientes y Casos Sociales
            </h1>
            <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
              Gestión Integral
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Bandeja unificada de seguimiento, intervenciones y resolución territorial de todas las áreas municipales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="rounded-xl font-bold text-xs gap-1.5 shadow-sm">
            <Link href="/cases/new">
              <Plus className="h-4 w-4" /> Nuevo Expediente
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Casos</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-foreground">{data.stats.totalAll}</p>
          <span className="text-[10px] text-muted-foreground">Registrados en el sistema</span>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">En Curso</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-emerald-500">{data.stats.active}</p>
          <span className="text-[10px] text-muted-foreground">Abiertos o en proceso</span>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Alertas Urgentes</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black mt-2 text-rose-500">{data.stats.urgent}</p>
          <span className="text-[10px] text-muted-foreground">Prioridad máxima</span>
        </Card>
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Resueltos</span>
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black mt-2 text-foreground">{data.stats.closed}</p>
          <span className="text-[10px] text-muted-foreground">Casos cerrados</span>
        </Card>
      </div>

      {/* Filters Form */}
      <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q || ""}
              placeholder="Buscar por carátula, DNI o apellido..."
              className="pl-9 h-10 rounded-xl bg-muted/30 border-border/60 text-xs"
            />
          </div>
          <div className="lg:col-span-3">
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
              <option value="ABIERTO">Abierto</option>
              <option value="EN_PROCESO">En Proceso</option>
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
          <div className="lg:col-span-1 flex gap-1">
            <Button type="submit" size="sm" className="h-10 w-full rounded-xl text-xs font-bold">
              Filtrar
            </Button>
          </div>
        </form>
        {(q || (area && area !== "all") || (status && status !== "all") || (priority && priority !== "all")) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40 text-xs">
            <span className="text-[11px] font-bold text-muted-foreground">Filtros activos:</span>
            {q && <Badge variant="secondary" className="text-[10px]">Texto: {q}</Badge>}
            {status && status !== "all" && <Badge variant="secondary" className="text-[10px]">Estado: {status}</Badge>}
            {priority && priority !== "all" && <Badge variant="secondary" className="text-[10px]">Prioridad: {priority}</Badge>}
            <Button variant="ghost" size="sm" asChild className="h-6 text-[10px] text-muted-foreground hover:text-foreground">
              <Link href="/cases">Limpiar Filtros</Link>
            </Button>
          </div>
        )}
      </Card>

      {/* Cases Table */}
      <Card className="rounded-2xl border-border/60 bg-card shadow-xs overflow-hidden">
        {data.cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="p-3 bg-muted/40 rounded-full text-muted-foreground">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-base text-foreground">No se encontraron expedientes</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              No hay casos que coincidan con los criterios de búsqueda o filtros seleccionados.
            </p>
            <Button asChild variant="outline" size="sm" className="rounded-xl mt-2 text-xs">
              <Link href="/cases">Restablecer búsqueda</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30">
                  <TableHead className="text-[11px] font-black uppercase text-muted-foreground">Carátula / Título</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-muted-foreground">Ciudadano</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-muted-foreground">Área</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-muted-foreground text-center">Prioridad</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-muted-foreground text-center">Estado</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-muted-foreground text-right">Actualizado</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-muted-foreground text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cases.map((c) => {
                  const isViolence =
                    c.area.name === "Violencia de Género" ||
                    c.area.name.toLowerCase().includes("violencia");
                  const isRestricted = isViolence && !canViewSensitive;
                  return (
                    <TableRow key={c.id} className="border-border/60 hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium max-w-xs">
                        <div className="truncate font-bold text-xs text-foreground">{c.title}</div>
                        {c.description && (
                          <div className="truncate text-[11px] text-muted-foreground mt-0.5 max-w-sm">
                            {isRestricted ? "Información confidencial reservada" : c.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {isRestricted ? (
                          <span className="text-muted-foreground italic text-[11px]">Identidad Reservada</span>
                        ) : c.person ? (
                          <div>
                            <Link href={`/people/${c.person.dni || c.person.id}`} className="font-bold hover:underline text-primary">
                              {c.person.lastName}, {c.person.firstName}
                            </Link>
                            <div className="text-[10px] text-muted-foreground font-mono">DNI: {c.person.dni}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Sin titular asignado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] border-border/60">
                          {c.area.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getPriorityBadge(c.priority)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(c.status)}
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground font-mono">
                        {new Date(c.updatedAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-bold">
                          <Link href={`/cases/${c.id}`}>
                            Ver <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>Mostrando página {data.currentPage} de {data.totalPages} ({data.total} casos en total)</span>
          <div className="flex gap-1">
            {data.currentPage > 1 && (
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                <Link href={`/cases?page=${data.currentPage - 1}${q ? `&q=${q}` : ""}${area ? `&area=${area}` : ""}${status ? `&status=${status}` : ""}${priority ? `&priority=${priority}` : ""}`}>
                  Anterior
                </Link>
              </Button>
            )}
            {data.currentPage < data.totalPages && (
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                <Link href={`/cases?page=${data.currentPage + 1}${q ? `&q=${q}` : ""}${area ? `&area=${area}` : ""}${status ? `&status=${status}` : ""}${priority ? `&priority=${priority}` : ""}`}>
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
