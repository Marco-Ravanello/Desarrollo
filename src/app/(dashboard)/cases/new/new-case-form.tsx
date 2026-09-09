"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, User, Check, X, ShieldAlert, Sparkles, FolderPlus,
  RefreshCw, ArrowRight, ArrowLeft, Plus, MapPin, Phone, Mail, Home
} from "lucide-react";
import Link from "next/link";
import { searchCitizensAction, createCentralizedCaseAction } from "../actions/case-actions";

type PriorityType = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

interface CitizenItem {
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  address?: string | null;
  barrio?: string | null;
  phone?: string | null;
  email?: string | null;
  programasActivos?: string[];
}

interface AreaItem {
  id: string;
  name: string;
  description?: string | null;
}

interface NewCaseFormProps {
  areas: AreaItem[];
  preselectedAreaId?: string;
  preselectedPerson?: CitizenItem | null;
}

const SUGGESTIONS_BY_AREA: Record<string, string[]> = {
  social: [
    "Asistencia Alimentaria de Emergencia",
    "Módulo Extraordinario por Contingencia Climática",
    "Subsidio de Integración Social Vulnerabilidad",
    "Solicitud de Exención de Tasa por Razones Sociales"
  ],
  habitat: [
    "Relevamiento Dominial y Regularización Dominial",
    "Mejoramiento Habitacional Urgente",
    "Informe Técnico de Habitabilidad de Vivienda",
    "Acompañamiento en Proceso de Escrituración Social"
  ],
  ninez: [
    "Medida de Protección Integral de Derechos (SLPPD)",
    "Intervención por Vulneración de Derechos en Niñez",
    "Ingreso a Programa Envión / Apoyo Comunitario",
    "Asistencia Social a Grupo Familiar con Menores a Cargo"
  ],
  violence: [
    "Intervención Integral por Violencia de Género (Ley 26.485)",
    "Solicitud de Alojamiento Protegido de Emergencia",
    "Acompañamiento Psicosocial y Asesoramiento Legal",
    "Medidas Urgentes de Restricción y Protección"
  ],
  default: [
    "Solicitud Asistencial Generica",
    "Informe de Evaluación Social Territorial",
    "Derivación Interinstitucional de Caso"
  ]
};

export function NewCaseForm({
  areas,
  preselectedAreaId,
  preselectedPerson
}: NewCaseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CitizenItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<CitizenItem | null>(preselectedPerson || null);

  const [areaId, setAreaId] = useState<string>(preselectedAreaId || areas[0]?.id || "");
  const [priority, setPriority] = useState<PriorityType>("MEDIA");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchCitizensAction(searchQuery);
      if (res.success && res.items) {
        setSuggestions(res.items);
      } else {
        setSuggestions([]);
      }
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectedAreaObj = areas.find((a) => a.id === areaId);
  const isViolenceArea =
    selectedAreaObj?.name.toLowerCase().includes("violencia") ||
    selectedAreaObj?.name.toLowerCase().includes("género") ||
    selectedAreaObj?.name.toLowerCase().includes("genero");

  const getQuickSuggestions = () => {
    if (!selectedAreaObj) return SUGGESTIONS_BY_AREA.default;
    const name = selectedAreaObj.name.toLowerCase();
    if (name.includes("social") || name.includes("protección")) return SUGGESTIONS_BY_AREA.social;
    if (name.includes("hábitat") || name.includes("habitat") || name.includes("vivienda")) return SUGGESTIONS_BY_AREA.habitat;
    if (name.includes("niñez") || name.includes("ninez") || name.includes("familia")) return SUGGESTIONS_BY_AREA.ninez;
    if (name.includes("violencia") || name.includes("género") || name.includes("genero")) return SUGGESTIONS_BY_AREA.violence;
    return SUGGESTIONS_BY_AREA.default;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPerson) {
      toast.error("Por favor seleccione un ciudadano del padrón");
      return;
    }

    if (!areaId) {
      toast.error("Seleccione un área responsable");
      return;
    }

    if (!title.trim()) {
      toast.error("Ingrese el título o carátula del expediente");
      return;
    }

    startTransition(async () => {
      const res = await createCentralizedCaseAction({
        title: title.trim(),
        description: description.trim() || undefined,
        areaId,
        priority,
        dni: selectedPerson.dni,
        firstName: selectedPerson.firstName,
        lastName: selectedPerson.lastName,
        address: selectedPerson.address || undefined,
        phone: selectedPerson.phone || undefined,
        email: selectedPerson.email || undefined
      });

      if (res.success && res.caseId) {
        toast.success(`Expediente creado: ${res.title}`);
        router.push(`/cases/${res.caseId}`);
      } else {
        toast.error(res.error || "Error al crear expediente");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-visible">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold">
              PASO 1
            </Badge>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Titular del Expediente (Búsqueda en Padrón Municipal)
            </h3>
          </div>

          {!selectedPerson ? (
            <div className="space-y-3 relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Escriba DNI, Apellido o Nombre del ciudadano..."
                  className="pl-11 pr-10 h-12 rounded-2xl text-xs sm:text-sm bg-muted/30 border-border/60 focus-visible:ring-primary text-foreground font-medium"
                />
                {isSearching && (
                  <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                )}
              </div>

              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-border/40">
                  <div className="p-2 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Ciudadanos coincidentes en padrón
                  </div>
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedPerson(item);
                        setSearchQuery("");
                        setSuggestions([]);
                      }}
                      className="w-full text-left p-3.5 hover:bg-muted/50 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary font-bold">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {item.lastName}, {item.firstName}
                          </p>
                          <p className="text-muted-foreground text-[11px] font-mono mt-0.5">
                            DNI: {item.dni} {item.barrio ? `• Barrio ${item.barrio}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-border/60">
                        Seleccionar
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>¿El vecino no figura registrado en el padrón?</span>
                <Button variant="outline" size="sm" asChild className="rounded-xl h-8 text-[11px] font-bold border-border/60">
                  <Link href="/people/new">
                    <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Registrar Nuevo Vecino
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-muted/30 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-base">
                  {selectedPerson.firstName[0]}{selectedPerson.lastName[0]}
                </div>
                <div>
                  <h4 className="text-base font-black text-foreground">
                    {selectedPerson.lastName}, {selectedPerson.firstName}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono text-xs font-bold border-border/60">
                      DNI: {selectedPerson.dni}
                    </Badge>
                    {selectedPerson.barrio && (
                      <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                        Barrio {selectedPerson.barrio}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedPerson(null)}
                className="rounded-xl h-9 text-xs font-bold border-border/60 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Cambiar Titular
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold">
              PASO 2
            </Badge>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Área Responsable y Prioridad Operativa
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Área Municipal Competente</Label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full h-11 px-3 rounded-2xl bg-muted/30 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Nivel de Prioridad / Severidad</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["BAJA", "MEDIA", "ALTA", "URGENTE"] as PriorityType[]).map((p) => {
                  const isSel = priority === p;
                  const config: Record<PriorityType, { label: string; activeClass: string }> = {
                    BAJA: { label: "🟢 BAJA", activeClass: "bg-emerald-500/20 text-emerald-500 border-emerald-500/40" },
                    MEDIA: { label: "🟡 MEDIA", activeClass: "bg-blue-500/20 text-blue-500 border-blue-500/40" },
                    ALTA: { label: "🟠 ALTA", activeClass: "bg-amber-500/20 text-amber-500 border-amber-500/40" },
                    URGENTE: { label: "🔴 URGENTE", activeClass: "bg-rose-500/20 text-rose-500 border-rose-500/40 animate-pulse" }
                  };

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`h-11 rounded-2xl border text-xs font-black transition-all flex items-center justify-center ${
                        isSel
                          ? `${config[p].activeClass} shadow-xs`
                          : "bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {config[p].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isViolenceArea && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-3 text-xs">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider">Manejo Confidencial de Expediente</p>
                <p className="text-rose-500/90 leading-relaxed mt-0.5">
                  Este expediente quedará restringido a agentes autorizados de Violencia de Género y Dirección General, bajo leyes 26.485 y 25.326.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-3xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold">
              PASO 3
            </Badge>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Carátula y Nota Inicial de Intervención
            </h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Asunto / Carátula del Expediente *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Asistencia Alimentaria por Contingencia Climatológica..."
                className="h-11 rounded-2xl bg-muted/30 border-border/60 text-xs sm:text-sm text-foreground font-medium"
              />

              <div className="pt-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Sugerencias rápidas para el área elegida:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {getQuickSuggestions().map((sugg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTitle(sugg)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-muted/40 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border/40 transition-colors"
                    >
                      + {sugg}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Informe Preliminar / Primera Intervención (Opcional)</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Detalle los antecedentes sociales, solicitudes del vecino, composición familiar o acciones inmediatas tomadas..."
                className="w-full p-3 rounded-2xl bg-muted/30 border border-border/60 text-xs text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="rounded-2xl h-12 px-6 font-bold text-xs border-border/60"
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          disabled={isPending || !selectedPerson}
          className="rounded-2xl h-12 px-8 font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2"
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <FolderPlus className="h-4 w-4" />
          )}
          <span>{isPending ? "Generando Expediente..." : "Abrir Expediente Social"}</span>
        </Button>
      </div>
    </form>
  );
}
