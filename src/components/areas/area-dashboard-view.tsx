"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { TableCards } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";
import {
  FolderPlus, Search, ShieldAlert, Users, AlertTriangle, Clock,
  CheckCircle2, FileText, ArrowRight, Eye, Layers, Sparkles
} from "lucide-react";
import Link from "next/link";
import { plural } from "@/lib/formato";

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
      bgAccent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      textAccent: "text-emerald-500",
      badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      buttonBg: "bg-primary hover:bg-primary/90 text-primary-foreground"
    },
    blue: {
      bgAccent: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      textAccent: "text-blue-500",
      badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      buttonBg: "bg-primary hover:bg-primary/90 text-primary-foreground"
    },
    amber: {
      bgAccent: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      textAccent: "text-amber-500",
      badgeBg: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30",
      buttonBg: "bg-primary hover:bg-primary/90 text-primary-foreground"
    },
    rose: {
      bgAccent: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      textAccent: "text-rose-500",
      badgeBg: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      buttonBg: "bg-primary hover:bg-primary/90 text-primary-foreground"
    }
  }[themeColor];

  const statTone = ({ emerald: "green", blue: "blue", amber: "orange", rose: "red" } as const)[themeColor];

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
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 font-bold text-xs">Abierto</Badge>;
      case "EN_PROCESO":
        return <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 font-bold text-xs">En proceso</Badge>;
      case "DERIVADO":
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 font-bold text-xs">Derivado</Badge>;
      case "CERRADO":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs">Cerrado</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-xs">{status}</Badge>;
    }
  };

  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENTE":
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-bold text-xs">🔴 Urgente</Badge>;
      case "ALTA":
        return <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 font-bold text-xs">🟠 Alta</Badge>;
      case "MEDIA":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 font-bold text-xs">🟡 Media</Badge>;
      case "BAJA":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs">🟢 Baja</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-xs">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title={areaTitle}
        description={areaDescription}
        icon={Layers}
        actions={
          area && (
            <Button asChild className={`rounded-2xl h-11 px-5 font-bold text-xs ${colorStyles.buttonBg} shadow-md`}>
              <Link href={`/cases/new${area?.id ? `?areaId=${area.id}` : ""}`}>
                <FolderPlus className="mr-2 h-4 w-4" /> Nuevo expediente
              </Link>
            </Button>
          )
        }
      />

      {isSensitive && (
        <Card className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 sm:p-5 text-rose-700 dark:text-rose-400">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">Protocolo de confidencialidad y protección de datos</p>
              <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                Los legajos de esta dirección general contienen datos altamente sensibles amparados por la Ley 26.485 (Protección Integral a las Mujeres) y Ley 25.326 (Habeas Data). Todas las acciones y consultas quedan registradas en el Registro de Auditoría Unificado.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Casos activos"
          value={stats.activeCases}
          hint="En proceso o abiertos"
          icon={Clock}
          tone={statTone}
        />
        <StatCard
          label="Urgencias críticas"
          value={stats.urgentCases}
          hint={<span className="font-bold text-amber-700 dark:text-amber-400">Prioridad alta / urgente</span>}
          icon={AlertTriangle}
          tone="orange"
        />
        <StatCard
          label="Intervenciones del mes"
          value={stats.monthlyInterventions}
          hint="Registradas en el mes"
          icon={FileText}
          tone="blue"
        />
        <StatCard
          label="Familias asistidas"
          value={stats.uniquePersons}
          hint={<span className="font-bold text-emerald-700 dark:text-emerald-400">Titulares únicos en área</span>}
          icon={Users}
          tone="green"
        />
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border/40 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("ACTIVOS")}
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "ACTIVOS"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Activos</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-md font-mono">
                {stats.activeCases}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("EN_PROCESO")}
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
                activeTab === "EN_PROCESO"
                  ? "bg-card text-foreground shadow-xs border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              En proceso
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("DERIVADOS")}
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
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
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
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
              className={`text-xs px-3.5 py-2 sm:py-1.5 rounded-xl font-bold transition-all ${
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
              aria-label="Filtrar por prioridad"
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

        <TableCards>
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/40">
              <tr>
                <th className="px-5 py-3.5">Carátula / asunto</th>
                <th className="px-4 py-3.5">Titular / vecino</th>
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
                      {plural(c._count?.interventions || 0, "intervención")}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl">
                        <Link href={`/cases/${c.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          <span>Ver legajo</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-0">
                    {searchQuery.trim() || priorityFilter !== "TODAS" ? (
                      <EmptyMessage
                        kind="search"
                        title="Ningún expediente coincide con la búsqueda"
                        description="Probá con otras palabras o con otra prioridad."
                        icon={Sparkles}
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs"
                            onClick={() => {
                              setSearchQuery("");
                              setPriorityFilter("TODAS");
                            }}
                          >
                            Quitar filtros
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyMessage
                        title="No hay expedientes en esta pestaña"
                        description="Probá con otra pestaña de arriba para ver los demás."
                        icon={Sparkles}
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCards>
      </Card>
    </div>
  );
}
