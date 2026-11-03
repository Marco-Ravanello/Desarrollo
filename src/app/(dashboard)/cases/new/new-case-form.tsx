"use client";

import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, User, X, ShieldAlert, Sparkles, FolderPlus,
  RefreshCw, Plus, AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { searchCitizensAction, createCentralizedCaseAction, openCasesInAreaAction } from "../actions/case-actions";
import { formatFecha } from "@/lib/fechas";
import { getAreaShortName } from "@/lib/area-theme";
import type { OpenCaseInArea } from "@/services/cases";
import { barrioLabel } from "@/lib/person-display";
import { CaseLabelPicker } from "@/components/cases/case-labels-editor";
import { RequiredMark } from "@/components/ui/form-section";

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
    "Asistencia alimentaria",
    "Ayuda por la tormenta",
    "Subsidio por vulnerabilidad social",
    "Exención de tasas por razones sociales"
  ],
  habitat: [
    "Regularización dominial",
    "Mejoramiento de la vivienda",
    "Informe de habitabilidad de la vivienda",
    "Acompañamiento en la escrituración"
  ],
  ninez: [
    "Medida de protección de derechos",
    "Vulneración de derechos de niñez",
    "Ingreso a Envión o apoyo comunitario",
    "Acompañamiento a familia con chicos a cargo"
  ],
  violence: [
    "Intervención por violencia de género",
    "Alojamiento protegido de emergencia",
    "Acompañamiento psicosocial y legal",
    "Medidas de restricción y protección"
  ],
  default: [
    "Pedido de asistencia",
    "Informe social",
    "Derivación a otra institución"
  ]
};

const PRIORITIES: { value: PriorityType; label: string; dot: string }[] = [
  { value: "BAJA", label: "Baja", dot: "bg-slate-400" },
  { value: "MEDIA", label: "Media", dot: "bg-sky-500" },
  { value: "ALTA", label: "Alta", dot: "bg-amber-500" },
  { value: "URGENTE", label: "Urgente", dot: "bg-rose-600" },
];

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

  const [areaId, setAreaId] = useState<string>(preselectedAreaId || "");
  const [priority, setPriority] = useState<PriorityType>("MEDIA");
  const [labels, setLabels] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [abiertos, setAbiertos] = useState<{ total: number; cases: OpenCaseInArea[] } | null>(null);

  // Si la persona ya tiene un expediente abierto en esa área, se avisa (igual se puede abrir otro).
  useEffect(() => {
    setAbiertos(null);
    if (!selectedPerson?.dni || !areaId) return;
    let vigente = true;
    openCasesInAreaAction(selectedPerson.dni, areaId)
      .then((r) => vigente && setAbiertos(r))
      .catch(() => null);
    return () => {
      vigente = false;
    };
  }, [selectedPerson?.dni, areaId]);

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
      toast.error("Elegí a la persona del padrón");
      return;
    }

    if (!areaId) {
      toast.error("Elegí el área responsable del expediente");
      return;
    }

    if (!title.trim()) {
      toast.error("Escribí la carátula del expediente");
      return;
    }

    startTransition(async () => {
      const res = await createCentralizedCaseAction({
        title: title.trim(),
        description: description.trim() || undefined,
        areaId,
        priority,
        labels,
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
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-visible">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Badge className="bg-primary/10 text-primary border border-primary/30 text-xs font-bold">
              Paso 1
            </Badge>
            <h3 className="text-sm font-bold text-foreground">
              Para quién es
            </h3>
          </div>

          {!selectedPerson ? (
            <div className="space-y-3 relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscá por DNI, apellido o nombre"
                  className="pl-11 pr-10 h-12 rounded-2xl text-xs sm:text-sm bg-muted/30 border-border/60 focus-visible:ring-primary text-foreground font-medium"
                />
                {isSearching && (
                  <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                )}
              </div>

              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-border/40">
                  <div className="p-2 bg-muted/40 text-xs font-bold text-muted-foreground">
                    Personas encontradas en el padrón
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
                          <p className="text-muted-foreground text-xs tabular-nums mt-0.5">
                            DNI: {item.dni} {item.barrio ? `• ${barrioLabel(item.barrio)}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-bold border-border/60">
                        Elegir
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>¿La persona no está en el padrón?</span>
                <Button variant="outline" size="sm" asChild className="rounded-xl h-8 text-xs font-bold border-border/60">
                  <Link href="/people/new">
                    <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Cargar persona
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-muted/30 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <InitialsAvatar name={selectedPerson.firstName} lastName={selectedPerson.lastName} seed={selectedPerson.dni} square className="h-12 w-12 text-base" />
                <div>
                  <h4 className="text-base font-bold text-foreground">
                    {selectedPerson.lastName}, {selectedPerson.firstName}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="tabular-nums text-xs font-bold border-border/60">
                      DNI: {selectedPerson.dni}
                    </Badge>
                    {selectedPerson.barrio && (
                      <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                        {barrioLabel(selectedPerson.barrio)}
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
                <X className="h-3.5 w-3.5 mr-1" /> Cambiar titular
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Badge className="bg-primary/10 text-primary border border-primary/30 text-xs font-bold">
              Paso 2
            </Badge>
            <h3 className="text-sm font-bold text-foreground">
              Área y prioridad
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Área que lo lleva <RequiredMark /></Label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                aria-label="Área responsable"
                className={`w-full h-11 px-3 rounded-2xl bg-muted/30 border border-border/60 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary ${areaId ? "text-foreground" : "text-muted-foreground"}`}
              >
                <option value="" disabled>
                  Elegí el área…
                </option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Prioridad</Label>
              <div role="radiogroup" aria-label="Prioridad" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITIES.map((p) => {
                  const isSel = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      onClick={() => setPriority(p.value)}
                      className={`h-11 rounded-2xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                        isSel
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border/60 bg-muted/20 text-foreground hover:border-primary/40"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${p.dot} ${isSel ? "ring-2 ring-white/70" : ""}`} aria-hidden />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {abiertos && abiertos.total > 0 && selectedPerson && (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div className="space-y-1.5">
                <p className="font-bold">
                  {selectedPerson.firstName} ya tiene {abiertos.total === 1 ? "un expediente abierto" : `${abiertos.total} expedientes abiertos`} en{" "}
                  {getAreaShortName(selectedAreaObj?.name ?? "esta área")}.
                </p>
                {abiertos.cases.length > 0 ? (
                  <ul className="space-y-1">
                    {abiertos.cases.map((c) => (
                      <li key={c.id}>
                        <Link href={`/cases/${c.id}`} className="font-semibold underline underline-offset-2 hover:no-underline">
                          {c.title}
                        </Link>{" "}
                        <span className="opacity-80">
                          · abierto el {formatFecha(c.createdAt)}
                          {c.assigneeName ? ` · a cargo de ${c.assigneeName}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Es un expediente reservado: no lo podés ver.</p>
                )}
                <p className="opacity-90">Si es por lo mismo, sumá una intervención ahí en lugar de abrir otro. Si es por otra cosa, podés seguir.</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Etiquetas (opcional)</Label>
            <p className="text-xs text-muted-foreground">Para encontrar y contar después los expedientes de cada situación. Se pueden cambiar más adelante.</p>
            <CaseLabelPicker value={labels} onChange={setLabels} />
          </div>

          {isViolenceArea && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-start gap-3 text-xs">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Expediente reservado</p>
                <p className="text-rose-700 dark:text-rose-300 leading-relaxed mt-0.5">
                  Solo lo van a ver las personas autorizadas para Violencia de Género (leyes 26.485 y 25.326).
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border border-border/60 shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Badge className="bg-primary/10 text-primary border border-primary/30 text-xs font-bold">
              Paso 3
            </Badge>
            <h3 className="text-sm font-bold text-foreground">
              Carátula y primera nota
            </h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Carátula <RequiredMark /></Label>
              <p className="text-xs text-muted-foreground">En pocas palabras, por qué se abre. Es lo que se ve en las listas.</p>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Por ejemplo: asistencia alimentaria"
                className="h-11 rounded-2xl bg-muted/30 border-border/60 text-xs sm:text-sm text-foreground font-medium"
              />

              <div className="pt-2">
                <p className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Ideas para esta área:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {getQuickSuggestions().map((sugg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTitle(sugg)}
                      className="text-xs font-bold px-2.5 py-1 rounded-xl bg-muted/40 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border/40 transition-colors"
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Primera intervención (opcional)</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Contá los antecedentes, qué pide la persona, cómo está compuesta la familia o qué se hizo hasta ahora"
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
          className="rounded-2xl h-12 px-8 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2"
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <FolderPlus className="h-4 w-4" />
          )}
          <span>{isPending ? "Abriendo el expediente…" : "Abrir expediente"}</span>
        </Button>
      </div>
    </form>
  );
}
