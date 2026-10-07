"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Printer, Save, UserCheck, ShieldAlert, Sparkles, MapPin, Phone, Home } from "lucide-react";
import { toast } from "sonner";
import { StormVictimItem, EmergencyPriority, SearchPersonSuggestion } from "@/types/emergency";
import { searchPeopleForEmergencyAction, saveStormVictimAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import { MunicipalLetterhead } from "@/components/ui/municipal-letterhead";

interface StormFichaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRecord?: StormVictimItem | null;
  operatorName: string;
  areaName: string;
  onSaved?: () => void;
}

export function StormFichaDialog({
  open,
  onOpenChange,
  initialRecord,
  operatorName,
  areaName,
  onSaved,
}: StormFichaDialogProps) {
  const [nombreApellido, setNombreApellido] = useState("");
  const [dni, setDni] = useState("");
  const [edad, setEdad] = useState("");
  const [grupoFamiliar, setGrupoFamiliar] = useState(false);
  const [ninos, setNinos] = useState("0");
  const [domicilio, setDomicilio] = useState("");
  const [referencia, setReferencia] = useState("");
  const [barrio, setBarrio] = useState("");
  const [contacto, setContacto] = useState("");
  const [agentes, setAgentes] = useState(operatorName);

  const [requiereColchon, setRequiereColchon] = useState(false);
  const [cantidadColchon, setCantidadColchon] = useState(0);
  const [requiereCama, setRequiereCama] = useState(false);
  const [cantidadCama, setCantidadCama] = useState(0);
  const [requiereCucheta, setRequiereCucheta] = useState(false);
  const [cantidadCucheta, setCantidadCucheta] = useState(0);
  const [requiereFrazada, setRequiereFrazada] = useState(false);
  const [cantidadFrazada, setCantidadFrazada] = useState(0);

  const [prioridad, setPrioridad] = useState<EmergencyPriority>("MEDIA");
  const [descripcionIntervencion, setDescripcionIntervencion] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [suggestions, setSuggestions] = useState<SearchPersonSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialRecord) {
      setNombreApellido(initialRecord.nombreApellido || "");
      setDni(initialRecord.dni || "");
      setEdad(initialRecord.edad || "");
      setGrupoFamiliar(Boolean(initialRecord.grupoFamiliar));
      setNinos(initialRecord.ninos || "0");
      setDomicilio(initialRecord.domicilio || "");
      setReferencia(initialRecord.referencia || "");
      setBarrio(initialRecord.barrio || "");
      setContacto(initialRecord.contacto || "");
      setAgentes(initialRecord.agentes || operatorName);

      setRequiereColchon(Boolean(initialRecord.requiereColchon));
      setCantidadColchon(initialRecord.cantidadColchon || 0);
      setRequiereCama(Boolean(initialRecord.requiereCama));
      setCantidadCama(initialRecord.cantidadCama || 0);
      setRequiereCucheta(Boolean(initialRecord.requiereCucheta));
      setCantidadCucheta(initialRecord.cantidadCucheta || 0);
      setRequiereFrazada(Boolean(initialRecord.requiereFrazada));
      setCantidadFrazada(initialRecord.cantidadFrazada || 0);

      setPrioridad((initialRecord.prioridad as EmergencyPriority) || "MEDIA");
      setDescripcionIntervencion(initialRecord.descripcionIntervencion || "");
      setObservaciones(initialRecord.observaciones || "");
    } else {
      resetForm();
    }
  }, [initialRecord, open, operatorName]);

  const resetForm = () => {
    setNombreApellido("");
    setDni("");
    setEdad("");
    setGrupoFamiliar(false);
    setNinos("0");
    setDomicilio("");
    setReferencia("");
    setBarrio("");
    setContacto("");
    setAgentes(operatorName);

    setRequiereColchon(false);
    setCantidadColchon(0);
    setRequiereCama(false);
    setCantidadCama(0);
    setRequiereCucheta(false);
    setCantidadCucheta(0);
    setRequiereFrazada(false);
    setCantidadFrazada(0);

    setPrioridad("MEDIA");
    setDescripcionIntervencion("");
    setObservaciones("");
    setSuggestions([]);
  };

  const handleSearchName = async (val: string) => {
    setNombreApellido(val);
    if (val.trim().length >= 3) {
      setIsSearching(true);
      const res = await searchPeopleForEmergencyAction(val);
      setSuggestions(res);
      setIsSearching(false);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (s: SearchPersonSuggestion) => {
    setNombreApellido(s.nombreApellido);
    setDni(s.dni);
    if (s.domicilio) setDomicilio(s.domicilio);
    if (s.barrio) setBarrio(s.barrio);
    if (s.edad) setEdad(s.edad);
    if (s.contacto) setContacto(s.contacto);
    setGrupoFamiliar(s.grupoFamiliar);
    if (s.ninos) setNinos(s.ninos);

    setShowSuggestions(false);
    toast.success("Datos del vecino autocompletados desde el padrón unificado");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreApellido.trim() || !domicilio.trim()) {
      toast.error("Por favor complete Nombre, Apellido y Domicilio");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Guardando Ficha de Tormenta...");

    const payload: Partial<StormVictimItem> = {
      id: initialRecord?.id,
      nombreApellido,
      dni,
      edad,
      grupoFamiliar,
      ninos,
      domicilio,
      referencia,
      barrio,
      contacto,
      agentes: agentes || operatorName,
      requiereColchon,
      cantidadColchon: requiereColchon ? Math.max(1, cantidadColchon) : 0,
      requiereCama,
      cantidadCama: requiereCama ? Math.max(1, cantidadCama) : 0,
      requiereCucheta,
      cantidadCucheta: requiereCucheta ? Math.max(1, cantidadCucheta) : 0,
      requiereFrazada,
      cantidadFrazada: requiereFrazada ? Math.max(1, cantidadFrazada) : 0,
      prioridad,
      descripcionIntervencion,
      observaciones,
    };

    const res = await saveStormVictimAction(payload);

    setIsSubmitting(false);
    if (res.success) {
      toast.success("Ficha - Tormenta guardada y sincronizada en base de datos", { id: toastId });
      onOpenChange(false);
      if (onSaved) onSaved();
    } else {
      toast.error(res.error || "Error al guardar la ficha", { id: toastId });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 print:p-0 print:max-w-full print:border-none print:shadow-none">
        {/* Printable Letterhead - Visible only in print or formatted modal header */}
        <div className="hidden print:block mb-6">
          <MunicipalLetterhead
            title="FICHA INDIVIDUAL DE CONTINGENCIA CLIMÁTICA"
            subtitle={`Secretaría de Desarrollo Humano • Área: ${areaName}`}
          />
        </div>

        <DialogHeader className="print:hidden border-b border-border/40 pb-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-amber-500" />
                FICHA - TORMENTA INDIVIDUAL (MUNI 3F)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Responsable: <b className="text-foreground">{operatorName}</b> • Área: <b className="text-foreground">{areaName}</b>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="rounded-xl font-bold text-xs"
              >
                <Printer className="mr-2 h-4 w-4" /> Imprimir Ficha
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Encabezado Institucional Ficha */}
          <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase font-black">Barrio / Localidad</Label>
              <Input
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                placeholder="Ej: Barrio Derqui / Caseros"
                className="h-9 rounded-xl text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase font-black">Agente(s) Intervinientes</Label>
              <Input
                value={agentes}
                onChange={(e) => setAgentes(e.target.value)}
                placeholder="Nombre del Agente Operativo"
                className="h-9 rounded-xl text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase font-black">Fecha y Hora</Label>
              <Input
                value={new Date().toLocaleDateString("es-AR") + " " + new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                readOnly
                className="h-9 rounded-xl text-xs mt-1 bg-muted/50 font-mono"
              />
            </div>
          </div>

          {/* Datos del Vecino o Grupo Familiar con Autocompletado */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" /> Datos del Afectado / Grupo Familiar
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <Label className="text-xs font-bold">Nombre y Apellido *</Label>
                <Input
                  value={nombreApellido}
                  onChange={(e) => handleSearchName(e.target.value)}
                  placeholder="Ingrese para buscar en padrón..."
                  className="h-10 rounded-xl text-xs font-bold uppercase mt-1"
                  required
                />
                {isSearching && (
                  <span className="absolute right-3 top-9 text-[10px] text-muted-foreground animate-pulse">
                    Buscando en padrón...
                  </span>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl max-h-56 overflow-y-auto p-1">
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase text-muted-foreground border-b border-border/40">
                      Sugerencias de Padrón Unificado
                    </div>
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-muted transition-colors text-xs flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-foreground">{s.nombreApellido}</p>
                          <p className="text-[11px] text-muted-foreground">
                            DNI: {s.dni} {s.domicilio ? `• ${s.domicilio}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold">
                          {s.source}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold">DNI / Documento</Label>
                <Input
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Número de DNI"
                  className="h-10 rounded-xl text-xs font-bold mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-bold">Edad Aprox.</Label>
                <Input
                  value={edad}
                  onChange={(e) => setEdad(e.target.value)}
                  placeholder="Ej: 38"
                  className="h-10 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Teléfono / Contacto</Label>
                <Input
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Ej: 11-2345-6789"
                  className="h-10 rounded-xl text-xs mt-1"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Checkbox
                  id="grupoFamiliar"
                  checked={grupoFamiliar}
                  onCheckedChange={(checked) => setGrupoFamiliar(Boolean(checked))}
                  className="rounded-md"
                />
                <Label htmlFor="grupoFamiliar" className="text-xs font-bold cursor-pointer">
                  ¿Posee Grupo Familiar a cargo?
                </Label>
              </div>

              <div>
                <Label className="text-xs font-bold">Cantidad de Niños</Label>
                <Input
                  type="number"
                  value={ninos}
                  onChange={(e) => setNinos(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold mt-1"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs font-bold">Domicilio Exacto *</Label>
                <Input
                  value={domicilio}
                  onChange={(e) => setDomicilio(e.target.value)}
                  placeholder="Calle, número, entre calles..."
                  className="h-10 rounded-xl text-xs font-bold mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Referencia Territorial</Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej: Frente al zanjón / Casa esquina azul"
                  className="h-10 rounded-xl text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Emergencia Social y Prioridad */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Nivel de Emergencia Social & Prioridad
              </h4>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(["ALTA", "MEDIA", "BAJA"] as EmergencyPriority[]).map((p) => {
                const selected = prioridad === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridad(p)}
                    className={`p-3 rounded-2xl border text-center transition-all flex items-center justify-center gap-2 font-black text-xs ${
                      selected
                        ? p === "ALTA"
                          ? "bg-rose-500 text-white border-rose-600 shadow-md"
                          : p === "MEDIA"
                          ? "bg-amber-500 text-black border-amber-600 shadow-md"
                          : "bg-emerald-600 text-white border-emerald-700 shadow-md"
                        : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>[{selected ? "X" : " "}]</span>
                    <span>PRIORIDAD {p}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <Label className="text-xs font-bold">Descripción de la Intervención Social</Label>
              <textarea
                value={descripcionIntervencion}
                onChange={(e) => setDescripcionIntervencion(e.target.value)}
                placeholder="Detalle de afectación por temporal (ingreso de agua, voladura de techo, asistencia médica, contención)..."
                className="w-full min-h-[90px] rounded-2xl bg-background border border-border text-xs p-3 font-medium mt-1 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Asignación de Elementos Solicitados */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Asignación de Elementos de Emergencia
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/50">
              {/* Colchón */}
              <div className="space-y-2 p-3 bg-background rounded-xl border border-border/60">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reqColchon"
                    checked={requiereColchon}
                    onCheckedChange={(c) => {
                      setRequiereColchon(Boolean(c));
                      if (c && cantidadColchon === 0) setCantidadColchon(1);
                    }}
                  />
                  <Label htmlFor="reqColchon" className="text-xs font-black cursor-pointer">
                    Colchón
                  </Label>
                </div>
                {requiereColchon && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground font-bold">Cantidad</Label>
                    <Input
                      type="number"
                      value={cantidadColchon}
                      onChange={(e) => setCantidadColchon(Number(e.target.value))}
                      min="1"
                      className="h-8 rounded-lg text-xs font-bold mt-0.5"
                    />
                  </div>
                )}
              </div>

              {/* Cama */}
              <div className="space-y-2 p-3 bg-background rounded-xl border border-border/60">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reqCama"
                    checked={requiereCama}
                    onCheckedChange={(c) => {
                      setRequiereCama(Boolean(c));
                      if (c && cantidadCama === 0) setCantidadCama(1);
                    }}
                  />
                  <Label htmlFor="reqCama" className="text-xs font-black cursor-pointer">
                    Cama
                  </Label>
                </div>
                {requiereCama && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground font-bold">Cantidad</Label>
                    <Input
                      type="number"
                      value={cantidadCama}
                      onChange={(e) => setCantidadCama(Number(e.target.value))}
                      min="1"
                      className="h-8 rounded-lg text-xs font-bold mt-0.5"
                    />
                  </div>
                )}
              </div>

              {/* Cucheta */}
              <div className="space-y-2 p-3 bg-background rounded-xl border border-border/60">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reqCucheta"
                    checked={requiereCucheta}
                    onCheckedChange={(c) => {
                      setRequiereCucheta(Boolean(c));
                      if (c && cantidadCucheta === 0) setCantidadCucheta(1);
                    }}
                  />
                  <Label htmlFor="reqCucheta" className="text-xs font-black cursor-pointer">
                    Cucheta
                  </Label>
                </div>
                {requiereCucheta && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground font-bold">Cantidad</Label>
                    <Input
                      type="number"
                      value={cantidadCucheta}
                      onChange={(e) => setCantidadCucheta(Number(e.target.value))}
                      min="1"
                      className="h-8 rounded-lg text-xs font-bold mt-0.5"
                    />
                  </div>
                )}
              </div>

              {/* Frazada */}
              <div className="space-y-2 p-3 bg-background rounded-xl border border-border/60">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reqFrazada"
                    checked={requiereFrazada}
                    onCheckedChange={(c) => {
                      setRequiereFrazada(Boolean(c));
                      if (c && cantidadFrazada === 0) setCantidadFrazada(1);
                    }}
                  />
                  <Label htmlFor="reqFrazada" className="text-xs font-black cursor-pointer">
                    Frazada
                  </Label>
                </div>
                {requiereFrazada && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground font-bold">Cantidad</Label>
                    <Input
                      type="number"
                      value={cantidadFrazada}
                      onChange={(e) => setCantidadFrazada(Number(e.target.value))}
                      min="1"
                      className="h-8 rounded-lg text-xs font-bold mt-0.5"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden border-t border-border/40 pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Guardando..." : "Guardar y Abrir Expediente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
