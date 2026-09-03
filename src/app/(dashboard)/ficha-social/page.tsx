"use client";

import { useState, useEffect, useTransition } from "react";
import {
  searchFichaSocialByDni,
  getSuggestions,
  FichaSocialPersonaResponse,
  SugerenciaBusqueda
} from "@/services/ficha-social";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Users, User, MapPin, Phone,
  Layers, ArrowRight, Share2, Sparkles, AlertCircle, CheckCircle2,
  ExternalLink, Network, HeartHandshake, Baby, Home, RefreshCw, BarChart2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function FichaSocialPage() {
  const [searchTerm, setSearchTerm] = useState("34438385");
  const [suggestions, setSuggestions] = useState<SugerenciaBusqueda[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ficha, setFicha] = useState<FichaSocialPersonaResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (dniToSearch?: string) => {
    const term = dniToSearch || searchTerm;
    if (!term || term.trim().length < 4) {
      toast.error("Por favor ingrese un DNI o CUIL válido");
      return;
    }
    setShowSuggestions(false);

    startTransition(async () => {
      try {
        const result = await searchFichaSocialByDni(term);
        setFicha(result);
        if (result.encontrado) {
          toast.success(`Ficha 360° cargada: ${result.nombre_detectado}`);
        } else {
          toast.info("No se encontraron registros en las bases de datos de programas sociales.");
        }
      } catch (err) {
        toast.error("Error al consultar la Ficha Social Unificada.");
      }
    });
  };

  useEffect(() => {
    handleSearch("34438385");
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const timer = setTimeout(async () => {
        const suggs = await getSuggestions(searchTerm);
        setSuggestions(suggs);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                Ficha Social Unificada 360°
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
                  Cruce de Datos 3F
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cruce integral de bases de datos municipales, programas nacionales y detección automática de vínculos familiares.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="rounded-xl border-border/60 text-xs font-bold gap-2">
            <Link href="/ficha-social/cruces">
              <BarChart2 className="h-4 w-4 text-primary" />
              Matriz de Cruces Masivos
            </Link>
          </Button>
        </div>
      </div>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-visible relative">
        <CardContent className="p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-3 relative"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Buscar por DNI, CUIL, Nombre o Apellido (Ej: 34438385 o Pérez)..."
                className="pl-11 h-12 rounded-2xl text-xs sm:text-sm bg-muted/30 border-border/60 focus-visible:ring-primary text-foreground font-medium"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-border/40">
                  <div className="p-2 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Sugerencias encontradas en bases
                  </div>
                  {suggestions.map((sugg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchTerm(sugg.dni);
                        handleSearch(sugg.dni);
                      }}
                      className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div className="flex items-center gap-2.5">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <span className="font-bold text-foreground group-hover:text-primary">{sugg.nombre}</span>
                          <span className="text-muted-foreground ml-2 font-mono text-[11px]">DNI: {sugg.dni}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-border/60 text-muted-foreground truncate max-w-[200px]">
                        {sugg.origen}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="h-12 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0 shadow-sm"
            >
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Consultar Ficha 360°</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {ficha && ficha.encontrado ? (
        <div className="space-y-6">
          <Card className="bg-card text-card-foreground border border-border/60 shadow-sm rounded-3xl overflow-hidden">
            <div className="p-6 sm:p-7 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-primary-foreground text-2xl font-black shadow-lg shadow-primary/20">
                    {ficha.nombre_detectado ? ficha.nombre_detectado.split(" ").map(n => n[0]).slice(0, 2).join("") : "360"}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">{ficha.nombre_detectado}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="font-mono text-xs border-border/60 font-bold">
                        DNI / CUIL: {ficha.dni}
                      </Badge>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-bold">
                        {ficha.total_programas} Programas Activos
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild className="rounded-xl border-border/60 text-xs font-bold">
                    <Link href={`/people`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1 text-primary" />
                      Registro Único
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border/30 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mr-1">
                  Programas Sociales Detectados:
                </span>
                {ficha.programas_activos?.map((prog, idx) => (
                  <Badge
                    key={idx}
                    className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold py-1 px-3 rounded-xl transition-all"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    {prog}
                  </Badge>
                ))}
              </div>
            </div>

            <Tabs defaultValue="programas" className="w-full">
              <div className="px-6 pt-3 border-b border-border/40 bg-muted/20">
                <TabsList className="bg-muted/40 p-1 border border-border/40 rounded-xl">
                  <TabsTrigger value="programas" className="text-xs font-bold gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Detalle de Programas ({ficha.total_programas})
                  </TabsTrigger>
                  <TabsTrigger value="familia" className="text-xs font-bold gap-1.5">
                    <Share2 className="h-3.5 w-3.5" />
                    Árbol de Vínculos Familiares ({ficha.relaciones_familiares?.length || 0})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="programas" className="p-6 space-y-4 m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ficha.detalle_programas && Object.entries(ficha.detalle_programas).map(([progName, detalle], idx) => (
                    <Card key={idx} className="bg-muted/30 border border-border/40 rounded-2xl overflow-hidden shadow-xs hover:border-primary/40 transition-all">
                      <div className="p-4 border-b border-border/30 bg-muted/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <HeartHandshake className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-foreground leading-tight">{progName}</h3>
                            <p className="text-[10px] text-muted-foreground font-medium">
                              Roles: {detalle.roles.join(", ")}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-border/60 font-bold">
                          {detalle.cantidad_registros} registro(s)
                        </Badge>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        {detalle.registros.map((reg, rIdx) => (
                          <div key={rIdx} className="space-y-2 text-xs">
                            {reg.datos_beneficiario?.nombre && reg.datos_beneficiario.nombre !== ficha.nombre_detectado && (
                              <div className="p-2.5 rounded-xl bg-background/60 border border-border/30 flex items-center justify-between">
                                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                                  <Baby className="h-3.5 w-3.5 text-blue-500" /> Beneficiario a cargo:
                                </span>
                                <span className="font-bold text-foreground">
                                  {reg.datos_beneficiario.nombre} (DNI: {reg.datos_beneficiario.dni || "N/R"})
                                </span>
                              </div>
                            )}

                            {reg.datos_contacto && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                {reg.datos_contacto.telefono && (
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 text-primary shrink-0" />
                                    <span className="text-foreground font-medium">{reg.datos_contacto.telefono}</span>
                                  </div>
                                )}
                                {reg.datos_contacto.direccion && (
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                                    <span className="text-foreground font-medium">{reg.datos_contacto.direccion}</span>
                                  </div>
                                )}
                                {reg.datos_contacto.barrio && (
                                  <div className="flex items-center gap-1.5">
                                    <Home className="h-3 w-3 text-primary shrink-0" />
                                    <span className="text-foreground font-medium">Barrio: {reg.datos_contacto.barrio}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {reg.datos_adicionales && Object.keys(reg.datos_adicionales).length > 0 && (
                              <div className="pt-2 border-t border-border/20 grid grid-cols-2 gap-1.5 text-[10px]">
                                {Object.entries(reg.datos_adicionales).map(([k, v], vIdx) => (
                                  <div key={vIdx} className="bg-background/40 px-2 py-1 rounded-lg">
                                    <span className="text-muted-foreground font-semibold">{k}:</span>{" "}
                                    <span className="text-foreground font-bold">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="familia" className="p-6 space-y-4 m-0">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-foreground">Inferencia Automática de Vínculos Familiares</p>
                    <p className="text-muted-foreground leading-relaxed">
                      El motor cruza automáticamente los roles de <b>Titular/Adulto Responsable</b> y <b>Beneficiario Menor</b> en todas las bases (Jardines, Tarjeta Alimentar, Niñez, etc.) para reconstruir el árbol de parentesco sin necesidad de carga manual.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ficha.relaciones_familiares && ficha.relaciones_familiares.length > 0 ? (
                    ficha.relaciones_familiares.map((rel, idx) => (
                      <Card key={idx} className="bg-muted/30 border border-border/40 rounded-2xl p-4 space-y-3 hover:border-primary/40 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {rel.nombre_completo.charAt(0)}
                          </div>
                          <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold">
                            {rel.tipo_relacion}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="font-black text-foreground text-sm leading-tight">{rel.nombre_completo}</h4>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">DNI: {rel.dni}</p>
                        </div>
                        <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border/30">
                          <p>
                            <span className="font-semibold">Visto en:</span> {rel.programas.join(", ")}
                          </p>
                          {rel.telefono && <p>Tel: {rel.telefono}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchTerm(rel.dni);
                            handleSearch(rel.dni);
                          }}
                          className="w-full text-xs font-bold text-primary hover:bg-primary/10 rounded-xl gap-1.5 h-8"
                        >
                          <span>Ver Ficha 360° de {rel.nombre_completo.split(" ")[0]}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-3xl">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
                      <p className="text-xs font-bold">No se detectaron vínculos familiares automáticos para este DNI.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      ) : ficha && !ficha.encontrado ? (
        <Card className="bg-card border border-border/60 rounded-3xl p-12 text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-500/60" />
          <h3 className="text-lg font-black text-foreground">No se encontraron registros</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            El DNI o CUIL ingresado no figura actualmente en las bases de datos de programas sociales del municipio.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
