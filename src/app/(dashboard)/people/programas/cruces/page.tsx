"use client";

import { chartPalette } from "@/lib/chart-colors";
import { useState, useEffect, useTransition } from "react";
import {
  getProgramCatalog,
  calculateCrossPrograms,
  ProgramaCatalogoItem,
  CruceProgramasResultado
} from "@/services/ficha-social";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Check, Plus, ArrowLeft, Users, Building, Network } from "lucide-react";
import { MODOS_CRUCE, fraseDelCruce, nombreDelModo, type ModoCruce } from "@/lib/cruces";
import { formatNumber, plural } from "@/lib/formato";
import Link from "next/link";
import { toast } from "sonner";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip as RechartsTooltip
} from "recharts";
import { useTheme } from "next-themes";
import { UniversalExportMenu } from "@/components/ui/universal-export-menu";
import { TableCards } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";


export default function CrucesSocialesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const COLORS = chartPalette(isDark);

  const [catalog, setCatalog] = useState<ProgramaCatalogoItem[]>([]);
  // En el orden en que se eligieron.
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([
    "Jardines Municipales",
    "Tarjeta Alimentar"
  ]);
  const [modo, setModo] = useState<ModoCruce>("interseccion");
  // Para "Exclusión": el programa base (si no se elige, el primero).
  const [base, setBase] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [cruceData, setCruceData] = useState<CruceProgramasResultado | null>(null);
  // El cruce sin la búsqueda de la lista: el número grande y "Dónde viven" no cambian al buscar.
  const [resumen, setResumen] = useState<CruceProgramasResultado | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadCatalog() {
      const progs = await getProgramCatalog();
      setCatalog(progs);
    }
    loadCatalog();
  }, []);

  const baseActual = base && selectedPrograms.includes(base) ? base : selectedPrograms[0] ?? null;
  // En "Exclusión" el programa base va primero.
  const ordered = modo === "diferencia" && baseActual
    ? [baseActual, ...selectedPrograms.filter((p) => p !== baseActual)]
    : selectedPrograms;
  const orderedKey = ordered.join("||");

  const runCruce = (q: string) => {
    if (ordered.length === 0) {
      setCruceData(null);
      setResumen(null);
      return;
    }
    startTransition(async () => {
      try {
        const [res, sinBuscar] = await Promise.all([
          calculateCrossPrograms(ordered, modo, { q, limit: 50 }),
          q ? calculateCrossPrograms(ordered, modo, { limit: 1 }) : Promise.resolve(null),
        ]);
        setCruceData(res);
        setResumen(sinBuscar ?? res);
      } catch {
        toast.error("No se pudo calcular el cruce. Revisá la conexión y probá de nuevo.");
      }
    });
  };

  // El resultado se actualiza solo al cambiar los programas o el tipo de cruce.
  useEffect(() => {
    runCruce(filterText.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedKey, modo]);

  // Y la búsqueda en la lista, un momento después de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => runCruce(filterText.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterText]);

  const toggleProgram = (name: string) => {
    setSelectedPrograms(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  const modoInfo = MODOS_CRUCE.find((m) => m.id === modo) ?? MODOS_CRUCE[0];
  const total = resumen?.total_coincidencias ?? 0;
  const enLista = cruceData?.total_coincidencias ?? 0;
  const shown = cruceData?.resultados.length ?? 0;
  const buscando = filterText.trim().length > 0;

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
              <Link href="/people/programas" aria-label="Volver a Programas">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <UniversalExportMenu
              data={exportData}
              columns={exportColumns}
              filename="cruce_de_programas_3f"
              title="Cruce de programas"
              subtitle={`${nombreDelModo(modo)}: ${fraseDelCruce(ordered, modo)}`}
              label="Exportar"
              orientation="landscape"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="order-2 lg:order-1 lg:col-span-2 bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Tipo de cruce</p>
              <div role="radiogroup" aria-label="Tipo de cruce" className="grid w-full grid-cols-3 gap-1 rounded-xl sm:inline-grid sm:w-auto border border-border/60 bg-muted/30 p-1">
                {MODOS_CRUCE.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={modo === m.id}
                    onClick={() => setModo(m.id)}
                    className={`rounded-lg px-2 py-1.5 text-sm font-semibold sm:px-3.5 transition-colors ${
                      modo === m.id ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.nombre}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{modoInfo.descripcion}</p>
            </div>

            {modo === "diferencia" && selectedPrograms.length > 1 && (
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">Programa base</span>
                <select
                  value={baseActual ?? ""}
                  onChange={(e) => setBase(e.target.value)}
                  className="h-9 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {selectedPrograms.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Programas</p>
                {selectedPrograms.length > 0 && (
                  <button type="button" onClick={() => setSelectedPrograms([])} className="text-xs font-semibold text-primary hover:underline">
                    Quitar todos
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {catalog.map((prog) => {
                  const isSelected = selectedPrograms.includes(prog.nombre);
                  return (
                    <button
                      key={prog.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleProgram(prog.nombre)}
                      title={prog.descripcion}
                      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-muted/30 text-foreground hover:border-primary/40"
                      }`}
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                      <span className="truncate">{prog.nombre}</span>
                      {prog.total_personas !== null && (
                        <span className={`tabular-nums ${isSelected ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                          {formatNumber(prog.total_personas)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card aria-live="polite" aria-busy={isPending} className="order-1 lg:order-2 lg:self-start bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl">
          <CardContent className="flex flex-col gap-2 p-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Users className="h-4 w-4 text-primary" aria-hidden /> Resultado · {modoInfo.nombre}
            </p>
            {ordered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Elegí al menos un programa para ver el cruce.</p>
            ) : (
              <>
                <p className={`font-heading text-4xl font-bold tabular-nums text-[#163C68] dark:text-blue-100 ${isPending ? "opacity-50" : ""}`}>
                  {formatNumber(total)}
                </p>
                <p className="text-sm text-foreground">
                  {total === 1 ? "persona" : "personas"} {fraseDelCruce(ordered, modo)}.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {resumen?.distribucion_barrios && resumen.distribucion_barrios.length > 0 && (
        <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary" /> Dónde viven
              </h3>
              <p className="text-xs text-muted-foreground">Los barrios con más personas de este cruce.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={resumen.distribucion_barrios}>
              <XAxis dataKey="barrio" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '11px'
                }}
              />
              <Bar dataKey="cantidad" name="Personas" radius={[6, 6, 0, 0]} fill={COLORS[0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/40 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-sm font-bold text-foreground">Personas</span>
            <p className="text-xs text-muted-foreground tabular-nums">
              {shown < enLista
                ? `Se muestran las primeras ${formatNumber(shown)} de ${formatNumber(enLista)}${buscando ? " que coinciden con la búsqueda" : ""}.`
                : buscando
                  ? `${plural(enLista, "persona coincide", "personas coinciden")} con la búsqueda`
                  : plural(enLista, "persona")}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              aria-label="Buscar en la lista"
              placeholder="Buscar por nombre, DNI o barrio"
              className="h-9 rounded-xl border-border/60 bg-background pl-9 text-xs"
            />
          </div>
        </div>
        <TableCards>
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b border-border/60">
              <tr>
                <th className="h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Persona</th>
                <th className="h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">DNI</th>
                <th className="h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Programas</th>
                <th className="h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Barrio / localidad</th>
                <th className="h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Contacto</th>
                <th className="h-11 px-4 align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {cruceData && cruceData.resultados.length > 0 ? (
                cruceData.resultados.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50 transition-colors hover:bg-muted/60">
                    <td className="px-4 py-3 align-middle font-bold text-foreground">{row.nombre}</td>
                    <td className="px-4 py-3 align-middle tabular-nums text-muted-foreground">{row.dni}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {row.programas.map((p, pIdx) => (
                          <Badge key={pIdx} variant="outline" className="text-xs border-primary/30 text-primary font-bold">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {row.contacto?.barrio || row.contacto?.localidad || "No especificado"}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground tabular-nums">
                      {row.contacto?.telefono || "N/R"}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
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
                    {isPending ? "Calculando el cruce…" : (
                      <EmptyMessage
                        kind="search"
                        title={ordered.length === 0 ? "Todavía no elegiste programas" : filterText.trim() ? "Nadie coincide con la búsqueda" : `Nadie ${fraseDelCruce(ordered, modo)}`}
                        description={ordered.length === 0 ? "Elegí uno o más programas arriba." : filterText.trim() ? "Probá con otro nombre, DNI o barrio." : "Probá con otros programas o con otro tipo de cruce."}
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
