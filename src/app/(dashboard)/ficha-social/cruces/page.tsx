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
  Layers, ArrowLeft, Users, Building
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip as RechartsTooltip, Cell
} from "recharts";
import { useTheme } from "next-themes";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";

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
      toast.error("Seleccione al menos un programa social para cruzar.");
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
    { header: "Nombre y Apellido", accessorKey: "nombre" },
    { header: "DNI", accessorKey: "dni" },
    { header: "Programas Activos", accessorKey: "programasStr" },
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="rounded-xl h-9 w-9">
              <Link href="/ficha-social">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                Matriz de Cruces Masivos & Auditoría
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
                  Analítica 3F
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detección de superposiciones de beneficios, duplicidades y cálculo de cobertura poblacional unificada.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UniversalExportMenu
            data={exportData}
            columns={exportColumns}
            filename="matriz_cruces_sociales_3f"
            title="Matriz de Beneficiarios y Cruces de Programas Sociales"
            subtitle="AUDITORÍA SOCIAL Y COBERTURA POBLACIONAL"
            label="Exportar Matriz"
            orientation="landscape"
          />
        </div>
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Catálogo de Programas Sociales Disponibles
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Seleccione 2 o más programas para calcular la matriz de cruce en tiempo real.
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
                    <span className="font-black text-xs text-foreground leading-tight">{prog.nombre}</span>
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1 mb-2 font-medium">{prog.descripcion}</p>
                  <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border/20">
                    <span className="text-muted-foreground font-mono">{prog.total_personas.toLocaleString()} pers.</span>
                    <Badge variant="outline" className="text-[9px] py-0 border-border/40">
                      {prog.area.split(" ")[0]}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card text-card-foreground border border-border/60 rounded-3xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Coincidencias Cruzadas</p>
            <h3 className="text-2xl font-black text-foreground">
              {cruceData?.total_coincidencias.toLocaleString() || 0}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Modo: <b className="uppercase">{modo}</b>
            </p>
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-3xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Programas Seleccionados</p>
            <h3 className="text-2xl font-black text-foreground">{selectedPrograms.length}</h3>
            <p className="text-[10px] text-muted-foreground">Bases de datos cruzadas</p>
          </div>
        </Card>

        <Card className="bg-card text-card-foreground border border-border/60 rounded-3xl p-5 shadow-xs flex flex-col justify-center">
          <div className="flex gap-2">
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCruce()}
              placeholder="Filtrar por barrio, DNI o nombre..."
              className="h-10 text-xs rounded-xl bg-muted/30 border-border/60"
            />
            <Button onClick={runCruce} size="sm" className="rounded-xl h-10 px-3">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>

      {cruceData?.distribucion_barrios && cruceData.distribucion_barrios.length > 0 && (
        <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary" /> Concentración Territorial por Barrio Popular
              </h3>
              <p className="text-[11px] text-muted-foreground">Distribución de personas alcanzadas por el cruce según barrio.</p>
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

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
        <div className="p-4 bg-muted/20 border-b border-border/40 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-foreground">
            Listado Nominal de Beneficiarios Cruzados
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Mostrando {cruceData?.resultados.length || 0} registros
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-bold tracking-wider border-b border-border/40">
              <tr>
                <th className="px-5 py-3">Ciudadano</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Programas Activos</th>
                <th className="px-4 py-3">Barrio / Localidad</th>
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
                          <Badge key={pIdx} variant="outline" className="text-[9px] border-primary/30 text-primary font-bold">
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
                      <Button variant="ghost" size="sm" asChild className="h-7 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg">
                        <Link href={`/ficha-social`}>
                          Ver Ficha 360°
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground italic">
                    {isPending ? "Calculando matriz de cruces..." : "No se encontraron coincidencias para los programas seleccionados."}
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
