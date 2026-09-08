"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import {
  FolderPlus, Search, ShieldAlert, Users, AlertTriangle, Clock,
  CheckCircle2, FileText, ArrowRight, Eye, Layers, Sparkles
} from "lucide-react";
import Link from "next/link";

interface CaseItem {
  id: string;
  title: string;
  description?: string | null;
  status: "ABIERTO" | "EN_PROCESO" | "DERIVADO" | "CERRADO" | "PENDIENTE";
  priority: "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
  updatedAt: string | Date;
  createdAt: string | Date;
  person: {
    id: string;
    dni: string;
    firstName: string;
    lastName: string;
  };
  _count?: {
    interventions: number;
    documents: number;
  };
}

interface AreaStats {
  totalCases: number;
  activeCases: number;
  urgentCases: number;
  monthlyInterventions: number;
  uniquePersons: number;
}

interface AreaDashboardViewProps {
  areaTitle: string;
  areaDescription: string;
  themeColor: "emerald" | "blue" | "amber" | "rose";
  area: { id: string; name: string; description?: string | null } | null;
  initialCases: CaseItem[];
  stats: AreaStats;
  isSensitive?: boolean;
}

export function AreaDashboardView({
  areaTitle,
  areaDescription,
  themeColor,
  area,
  initialCases,
  stats,
  isSensitive = false
}: AreaDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<"ACTIVOS" | "TODOS" | "EN_PROCESO" | "DERIVADOS" | "CERRADOS">("ACTIVOS");
  const [priorityFilter, setPriorityFilter] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState("");

  const colorStyles = {
    emerald: {
      bgAccent: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      textAccent: "text-emerald-500",
      badgeBg: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white"
    },
    blue: {
      bgAccent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      textAccent: "text-blue-500",
      badgeBg: "bg-blue-500/15 text-blue-500 border-blue-500/30",
      buttonBg: "bg-blue-600 hover:bg-blue-700 text-white"
    },
    amber: {
      bgAccent: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      textAccent: "text-amber-500",
      badgeBg: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      buttonBg: "bg-amber-600 hover:bg-amber-700 text-white"
    },
    rose: {
      bgAccent: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      textAccent: "text-rose-500",
      badgeBg: "bg-rose-500/15 text-rose-500 border-rose-500/30",
      buttonBg: "bg-rose-600 hover:bg-rose-700 text-white"
    }
  }[themeColor];

  const filteredCases = initialCases.filter((c) => {
    if (activeTab === "ACTIVOS" && c.status !== "ABIERTO" && c.status !== "EN_PROCESO") return false;
    if (activeTab === "EN_PROCESO" && c.status !== "EN_PROCESO") return false;
    if (activeTab === "DERIVADOS" && c.status !== "DERIVADO") return false;
    if (activeTab === "CERRADOS" && c.status !== "CERRADO") return false;

    if (priorityFilter !== "TODAS" && c.priority !== priorityFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchDni = c.person.dni.includes(q);
      const matchName = `${c.person.firstName} ${c.person.lastName}`.toLowerCase().includes(q);
      if (!matchTitle && !matchDni && !matchName) return false;
    }

    return true;
  });

  const exportColumns = [
    { header: "Expediente", accessorKey: "title" },
    { header: "Ciudadano", accessorKey: "citizenName" },
    { header: "DNI", accessorKey: "dni" },
    { header: "Estado", accessorKey: "status" },
    { header: "Prioridad", accessorKey: "priority" },
    { header: "Fecha Actualización", accessorKey: "updatedAt" },
    { header: "Total Intervenciones", accessorKey: "interventionsCount" }
  ];

  const exportData = filteredCases.map((c) => ({
    title: c.title,
    citizenName: `${c.person.lastName}, ${c.person.firstName}`,
    dni: c.person.dni,
    status: c.status,
    priority: c.priority,
    updatedAt: new Date(c.updatedAt).toLocaleDateString("es-AR"),
    interventionsCount: c._count?.interventions || 0
  }));

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "ABIERTO":
        return <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/30 font-bold text-[10px]">ABIERTO</Badge>;
      case "EN_PROCESO":
        return <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold text-[10px]">EN PROCESO</Badge>;
      case "DERIVADO":
        return <Badge className="bg-purple-500/15 text-purple-500 border border-purple-500/30 font-bold text-[10px]">DERIVADO</Badge>;
      case "CERRADO":
        return <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold text-[10px]">CERRADO</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-[10px]">{status}</Badge>;
    }
  };

  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENTE":
        return <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold text-[10px]">🔴 URGENTE</Badge>;
      case "ALTA":
        return <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold text-[10px]">🟠 ALTA</Badge>;
      case "MEDIA":
        return <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/30 font-bold text-[10px]">🟡 MEDIA</Badge>;
      case "BAJA":
        return <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold text-[10px]">🟢 BAJA</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-[10px]">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${colorStyles.bgAccent}`}>
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                {areaTitle}
                <Badge className={`${colorStyles.badgeBg} text-[10px] font-bold uppercase py-0.5`}>
                  Dashboard Operativo
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                {areaDescription}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {area && (
            <Button asChild className={`rounded-2xl h-11 px-5 font-bold text-xs uppercase tracking-wider ${colorStyles.buttonBg} shadow-md`}>
              <Link href={`/cases/new?areaId=${area.id}`}>
                <FolderPlus className="mr-2 h-4 w-4" /> Nuevo Expediente
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isSensitive && (
        <Card className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-4 sm:p-5 text-rose-500">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold uppercase tracking-wider">Protocolo de Confidencialidad y Protección de Datos</p>
              <p className="text-rose-500/90 leading-relaxed">
                Los legajos de esta dirección general contienen datos altamente sensibles amparados por la Ley 26.485 (Protección Integral a las Mujeres) y Ley 25.326 (Habeas Data). Todas las acciones y consultas quedan registradas en el Registro de Auditoría Unificado.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Casos Activos</p>
            <h3 className="text-2xl font-black text-foreground mt-1">{stats.activeCases}</h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">En proceso o abiertos</p>
          </div>
          <div className={`p-3 rounded-2xl border ${colorStyles.bgAccent}`}>
            <Clock className="h-6 w-6" />
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Urgencias Críticas</p>
            <h3 className="text-2xl font-black text-foreground mt-1">{stats.urgentCases}</h3>
            <p className="text-[10px] text-amber-500 font-bold mt-0.5">Prioridad Alta / Urgente</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Intervenciones Mes</p>
            <h3 className="text-2xl font-black text-foreground mt-1">{stats.monthlyInterventions}</h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Registradas en el mes</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <FileText className="h-6 w-6" />
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Familias Asistidas</p>
            <h3 className="text-2xl font-black text-foreground mt-1">{stats.uniquePersons}</h3>
            <p className="text-[10px] text-emerald-500 font-bold mt-0.5">Titulares únicos en área</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Users className="h-6 w-6" />
          </div>
        </Card>
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border/40 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("ACTIVOS")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "ACTIVOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Activos</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md font-mono">
                {stats.activeCases}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("EN_PROCESO")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "EN_PROCESO"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              En Proceso
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("DERIVADOS")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "DERIVADOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Derivados
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CERRADOS")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "CERRADOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cerrados
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("TODOS")}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "TODOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({stats.totalCases})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar carátula, DNI o vecino..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/60 text-foreground"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 px-3 rounded-xl bg-muted/20 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
            >
              <option value="TODAS">Todas las prioridades</option>
              <option value="URGENTE">🔴 Urgente</option>
              <option value="ALTA">🟠 Alta</option>
              <option value="MEDIA">🟡 Media</option>
              <option value="BAJA">🟢 Baja</option>
            </select>

            <UniversalExportMenu
              data={exportData}
              columns={exportColumns}
              filename={`expedientes_${areaTitle.toLowerCase().replace(/\s+/g, "_")}`}
              title={`Nómina de Expedientes - ${areaTitle}`}
              subtitle="MUNICIPALIDAD DE TRES DE FEBRERO"
              label="Exportar"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-bold tracking-wider border-b border-border/40">
              <tr>
                <th className="px-5 py-3.5">Carátula / Asunto</th>
                <th className="px-4 py-3.5">Titular / Vecino</th>
                <th className="px-4 py-3.5">DNI</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Prioridad</th>
                <th className="px-4 py-3.5">Intervenciones</th>
                <th className="px-4 py-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredCases.length > 0 ? (
                filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-foreground max-w-xs truncate">
                      <Link href={`/cases/${c.id}`} className="hover:text-primary transition-colors">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-foreground font-semibold">
                      <Link href={`/people/${c.person.id}`} className="hover:underline">
                        {c.person.lastName}, {c.person.firstName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">
                      {c.person.dni}
                    </td>
                    <td className="px-4 py-3.5">
                      {renderStatusBadge(c.status)}
                    </td>
                    <td className="px-4 py-3.5">
                      {renderPriorityBadge(c.priority)}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground font-bold">
                      {c._count?.interventions || 0} registro(s)
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl">
                        <Link href={`/cases/${c.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          <span>Ver Legajo</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
                    <p className="text-sm font-bold text-foreground">No se encontraron expedientes.</p>
                    <p className="text-xs text-muted-foreground mt-1">Pruebe modificando los filtros o la palabra clave de búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
