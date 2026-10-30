"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getProgramCatalog,
  calculateCrossPrograms,
  getExportCsvUrl,
  ProgramaCatalogoItem,
  CruceProgramasResultado
} from "@/services/ficha-social";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, CheckSquare, Square,
  Layers, ArrowLeft, Users, Building, Network
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip as RechartsTooltip, Cell
} from "recharts";
import { useTheme } from "next-themes";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { TableCards } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function CrucesSocialesPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [catalog, setCatalog] = useState<ProgramaCatalogoItem[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([
    "Jardines Municipales",
    "Tarjeta Alimentar"
  ]);
  const [modo, setModo] = useState<"interseccion" | "union">("interseccion");
  const [filterText, setFilterText] = useState("");
  const [cruceData, setCruceData] = useState<CruceProgramasResultado | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadCatalog() {
      const progs = await getProgramCatalog();
      setCatalog(progs);
    }
    loadCatalog();
  }, []);

  const runCruce = () => {
    if (selectedPrograms.length === 0) {
      toast.error("Elegí al menos un programa.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await calculateCrossPrograms(selectedPrograms, modo, { q: filterText, limit: 50 });
        setCruceData(res);
        toast.success(`Cruce calculado: ${res.total_coincidencias} coincidencias`);
      } catch (err) {
        toast.error("Error al calcular el cruce de programas.");
      }
    });
  };

  useEffect(() => {
    runCruce();
  }, [selectedPrograms, modo]);

  const toggleProgram = (name: string) => {
    setSelectedPrograms(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  const exportColumns = [
    { header: "Nombre y apellido", accessorKey: "nombre" },
    { header: "DNI", accessorKey: "dni" },
    { header: "Programas activos", accessorKey: "programasStr" },
    { header: "Barrio / Localidad", accessorKey: "barrio" },
    { header: "Teléfono", accessorKey: "telefono" }
  ];

  const exportData = (cruceData?.resultados || []).map(row => ({
    nombre: row.nombre,
    dni: row.dni,
    programasStr: row.programas.join(" | "),
    barrio: row.contacto?.barrio || row.contacto?.localidad || "No especificado",
    telefono: row.contacto?.telefono || "N/R"
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cruces de programas"
        description="Quiénes están en más de un programa a la vez y a cuánta gente llega cada uno."
        icon={Network}
        actions={
          <>
            <Button variant="ghost" size="icon" asChild className="rounded-xl h-9 w-9">
              <Link href="/ficha-social" aria-label="Volver">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <UniversalExportMenu
              data={exportData}
              columns={exportColumns}
              filename="matriz_cruces_sociales_3f"
              title="Cruces de programas sociales"
              subtitle="AUDITORÍA SOCIAL Y COBERTURA POBLACIONAL"
              label="Exportar"
              orientation="landscape"
            />
          </>
        }
      />

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Catálogo de programas sociales disponibles
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Elegí 2 o más programas para ver quiénes están en todos (o en alguno).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-background/60 p-1 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => setModo("interseccion")}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                  modo === "interseccion"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Intersección (Superposición)
              </button>
              <button
                type="button"
                onClick={() => setModo("union")}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                  modo === "union"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unión (Población Total)
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {catalog.map((prog) => {
              const isSelected = selectedPrograms.includes(prog.nombre);
              return (
                <div
                  key={prog.id}
                  onClick={() => toggleProgram(prog.nombre)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-xs"
                      : "bg-muted/30 border-border/40 hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-foreground leading-tight">{prog.nombre}</span>
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-2 font-medium">{prog.descripcion}</p>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/20">
                    <span className="text-muted-foreground">
                      {prog.total_personas === null
                        ? "Sin dato"
                        : `${prog.total_personas.toLocaleString("es-AR")} ${prog.total_personas === 1 ? "persona" : "personas"}`}
                    </span>
                    <Badge variant="outline" className="text-xs py-0 border-border/40">
                      {prog.area.split(" ")[0]}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label="Coincidencias cruzadas"
          value={cruceData?.total_coincidencias.toLocaleString("es-AR") || 0}
          hint={<>Modo: <b className="">{modo}</b></>}
          icon={Users}
          tone="blue"
        />

        <StatCard
          label="Programas seleccionados"
          value={selectedPrograms.length}
          hint="Bases de datos cruzadas"
          icon={Layers}
          tone="green"
        />

        <Card className="col-span-2 lg:col-span-1 bg-card text-card-foreground border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-center">
          <div className="flex gap-2">
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCruce()}
              placeholder="Filtrar por barrio, DNI o nombre..."
              className="h-10 text-xs rounded-xl bg-muted/30 border-border/60"
            />
            <Button onClick={runCruce} size="sm" aria-label="Cruzar programas" className="rounded-xl h-10 px-3">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>

      {cruceData?.distribucion_barrios && cruceData.distribucion_barrios.length > 0 && (
        <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary" /> Concentración territorial por barrio popular
              </h3>
              <p className="text-xs text-muted-foreground">Distribución de personas alcanzadas por el cruce según barrio.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cruceData.distribucion_barrios}>
              <XAxis dataKey="barrio" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '11px'
                }}
              />
              <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                {cruceData.distribucion_barrios.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <div className="p-4 bg-muted/20 border-b border-border/40 flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">
            Listado nominal de beneficiarios cruzados
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Mostrando {cruceData?.resultados.length || 0} registros
          </span>
        </div>
        <TableCards>
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/40">
              <tr>
                <th className="px-5 py-3">Persona</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Programas activos</th>
                <th className="px-4 py-3">Barrio / localidad</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {cruceData && cruceData.resultados.length > 0 ? (
                cruceData.resultados.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-foreground">{row.nombre}</td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">{row.dni}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {row.programas.map((p, pIdx) => (
                          <Badge key={pIdx} variant="outline" className="text-xs border-primary/30 text-primary font-bold">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {row.contacto?.barrio || row.contacto?.localidad || "No especificado"}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground font-mono">
                      {row.contacto?.telefono || "N/R"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button variant="ghost" size="sm" asChild className="h-7 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg">
                        <Link href={`/people/${row.dni}`}>
                          Ver ficha
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className={isPending ? "text-center py-12 text-muted-foreground italic" : "p-0"}>
                    {isPending ? "Calculando matriz de cruces..." : (
                      <EmptyMessage
                        kind="search"
                        title={modo === "interseccion" ? "Nadie está en todos los programas elegidos" : "Nadie está en los programas elegidos"}
                        description={modo === "interseccion" ? "Probá quitando alguno de los programas." : "Probá con otros programas."}
                        icon={Users}
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
