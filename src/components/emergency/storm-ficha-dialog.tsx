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
import { StormVictimItem, EmergencyPriority, SearchPersonSuggestion, EmergencyExtraItem } from "@/types/emergency";
import { searchPeopleForEmergencyAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import { saveFichaOrQueue } from "@/lib/emergency-offline";
import { MunicipalLetterhead } from "@/components/ui/municipal-letterhead";
import { STORM_BARRIOS, matchStormBarrio } from "@/lib/storm-barrios";
import { formatFechaHora } from "@/lib/fechas";
import { RequiredMark } from "@/components/ui/form-section";

interface StormFichaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRecord?: StormVictimItem | null;
  operatorName: string;
  areaName: string;
  onSaved?: () => void;
  /** Usuario que carga (las fichas sin conexión se guardan a su nombre en el dispositivo). */
  userId: string;
  /** Auditoría consulta e imprime pero no guarda. */
  canEdit?: boolean;
  /** Otros insumos que se pueden pedir (agregados desde Stock de Contingencia). */
  extraItems?: EmergencyExtraItem[];
}

export function StormFichaDialog({
  open,
  onOpenChange,
  initialRecord,
  operatorName,
  areaName,
  onSaved,
  userId,
  canEdit = true,
  extraItems = [],
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
  // Otros insumos pedidos: { idInsumo: cantidad }.
  const [otros, setOtros] = useState<Record<string, number>>({});

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
      // Las fichas anteriores al desplegable conservan lo que se escribió a mano.
      setBarrio(matchStormBarrio(initialRecord.barrio) ?? (initialRecord.barrio || ""));
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
      setOtros({ ...(initialRecord.otrosElementos || {}) });

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
    setOtros({});

    setPrioridad("MEDIA");
    setDescripcionIntervencion("");
    setObservaciones("");
    setSuggestions([]);
  };

  const handleSearchName = async (val: string) => {
    setNombreApellido(val);
    if (val.trim().length >= 3 && navigator.onLine !== false) {
      // Sin conexión no hay búsqueda en el padrón: se completa a mano.
      setIsSearching(true);
      const res = await searchPeopleForEmergencyAction(val).catch(() => []);
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
    // El barrio del padrón se usa solo si está en la lista; si no, se elige a mano.
    const barrioPadron = matchStormBarrio(s.barrio);
    if (barrioPadron) setBarrio(barrioPadron);
    if (s.edad) setEdad(s.edad);
    if (s.contacto) setContacto(s.contacto);
    setGrupoFamiliar(s.grupoFamiliar);
    if (s.ninos) setNinos(s.ninos);

    setShowSuggestions(false);
    toast.success("Datos de la persona completados desde el padrón");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreApellido.trim() || !domicilio.trim()) {
      toast.error("Completá nombre, apellido y domicilio");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Guardando ficha de tormenta…");

    const payload: Partial<StormVictimItem> = {
      id: initialRecord?.id || undefined,
      caseId: initialRecord?.caseId || undefined,
      // Una ficha que todavía está en el dispositivo conserva su identificador.
      clientId: initialRecord?.clientId || undefined,
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
      otrosElementos: Object.fromEntries(Object.entries(otros).filter(([, n]) => n > 0).map(([id, n]) => [id, Math.floor(n)])),
      prioridad,
      descripcionIntervencion,
      observaciones,
    };

    const res = await saveFichaOrQueue(userId, payload);

    setIsSubmitting(false);
    if (res.status === "saved") {
      toast.success("Ficha - Tormenta guardada y sincronizada en base de datos", { id: toastId });
      onOpenChange(false);
      if (onSaved) onSaved();
    } else if (res.status === "queued") {
      toast.warning(
        res.sessionExpired
          ? "Tu sesión venció: la ficha quedó guardada en este dispositivo. Volvé a iniciar sesión para enviarla."
          : "Sin conexión: la ficha quedó guardada en este dispositivo y se envía sola cuando vuelva internet.",
        { id: toastId, duration: 6000 }
      );
      onOpenChange(false);
    } else {
      toast.error(res.error || "Error al guardar la ficha", { id: toastId });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8 print:p-0 print:max-w-full print:border-none print:shadow-none">
        {/* Printable Letterhead - Visible only in print or formatted modal header */}
        <div className="hidden print:block mb-6">
          <MunicipalLetterhead direction={`Área: ${areaName}`} />
          <h1 className="text-lg font-bold text-center">FICHA INDIVIDUAL DE CONTINGENCIA CLIMÁTICA</h1>
        </div>

        <DialogHeader className="print:hidden border-b border-border/40 pb-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
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
                <Printer className="mr-2 h-4 w-4" /> Imprimir ficha
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Encabezado Institucional Ficha */}
          <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
            <div>
              <Label htmlFor="storm-barrio" className="text-xs text-muted-foreground font-bold">Barrio / localidad</Label>
              <select
                id="storm-barrio"
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Elegí el barrio…</option>
                {barrio && !matchStormBarrio(barrio) && <option value={barrio}>{barrio} (cargado antes)</option>}
                {STORM_BARRIOS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-bold">Agentes que intervinieron</Label>
              <Input
                value={agentes}
                onChange={(e) => setAgentes(e.target.value)}
                placeholder="Nombre del agente operativo"
                className="h-9 rounded-xl text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-bold">Fecha y hora</Label>
              <Input
                value={formatFechaHora(new Date())}
                readOnly
                className="h-9 rounded-xl text-xs mt-1 bg-muted/50 font-mono"
              />
            </div>
          </div>

          {/* Datos del Vecino o Grupo Familiar con Autocompletado */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" /> Datos del afectado / grupo familiar
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <Label className="text-xs font-bold">Nombre y apellido <RequiredMark /></Label>
                <Input
                  value={nombreApellido}
                  onChange={(e) => handleSearchName(e.target.value)}
                  placeholder="Escribí para buscar en el padrón"
                  className="h-10 rounded-xl text-xs font-bold mt-1"
                  required
                />
                {isSearching && (
                  <span className="absolute right-3 top-9 text-xs text-muted-foreground animate-pulse">
                    Buscando en padrón...
                  </span>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl max-h-56 overflow-y-auto p-1">
                    <div className="px-3 py-1.5 text-xs font-bold text-muted-foreground border-b border-border/40">
                      Sugerencias de padrón unificado
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
                          <p className="text-xs text-muted-foreground">
                            DNI: {s.dni} {s.domicilio ? `• ${s.domicilio}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs font-bold">
                          {s.source}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold">DNI / documento</Label>
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
                <Label className="text-xs font-bold">Edad aprox.</Label>
                <Input
                  value={edad}
                  onChange={(e) => setEdad(e.target.value)}
                  placeholder="Ej: 38"
                  className="h-10 rounded-xl text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Teléfono / contacto</Label>
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
                <Label className="text-xs font-bold">Cantidad de niños</Label>
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
                <Label className="text-xs font-bold">Domicilio exacto <RequiredMark /></Label>
                <Input
                  value={domicilio}
                  onChange={(e) => setDomicilio(e.target.value)}
                  placeholder="Calle, número, entre calles..."
                  className="h-10 rounded-xl text-xs font-bold mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Referencia territorial</Label>
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
              <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Nivel de emergencia y prioridad
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
                    className={`p-3 rounded-2xl border text-center transition-all flex items-center justify-center gap-2 font-bold text-xs ${
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
              <Label className="text-xs font-bold">Descripción de la intervención social</Label>
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
            <h4 className="text-xs font-bold text-muted-foreground">
              Asignación de elementos de emergencia
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
                  <Label htmlFor="reqColchon" className="text-xs font-bold cursor-pointer">
                    Colchón
                  </Label>
                </div>
                {requiereColchon && (
                  <div className="pt-1">
                    <Label className="text-xs text-muted-foreground font-bold">Cantidad</Label>
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
                  <Label htmlFor="reqCama" className="text-xs font-bold cursor-pointer">
                    Cama
                  </Label>
                </div>
                {requiereCama && (
                  <div className="pt-1">
                    <Label className="text-xs text-muted-foreground font-bold">Cantidad</Label>
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
                  <Label htmlFor="reqCucheta" className="text-xs font-bold cursor-pointer">
                    Cucheta
                  </Label>
                </div>
                {requiereCucheta && (
                  <div className="pt-1">
                    <Label className="text-xs text-muted-foreground font-bold">Cantidad</Label>
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
                  <Label htmlFor="reqFrazada" className="text-xs font-bold cursor-pointer">
                    Frazada
                  </Label>
                </div>
                {requiereFrazada && (
                  <div className="pt-1">
                    <Label className="text-xs text-muted-foreground font-bold">Cantidad</Label>
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

            {extraItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">Otros insumos</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/50">
                  {extraItems.map((item) => {
                    const qty = otros[item.id] || 0;
                    const inputId = `reqOtro-${item.id}`;
                    return (
                      <div key={item.id} className="space-y-2 p-3 bg-background rounded-xl border border-border/60">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={inputId}
                            checked={qty > 0}
                            onCheckedChange={(c) => setOtros((o) => ({ ...o, [item.id]: c ? Math.max(1, o[item.id] || 0) : 0 }))}
                          />
                          <Label htmlFor={inputId} className="text-xs font-bold cursor-pointer min-w-0 break-words">
                            {item.name}
                          </Label>
                        </div>
                        {qty > 0 && (
                          <div className="pt-1">
                            <Label className="text-xs text-muted-foreground font-bold">Cantidad ({item.unit.toLowerCase()})</Label>
                            <Input
                              type="number"
                              value={qty}
                              onChange={(e) => setOtros((o) => ({ ...o, [item.id]: Math.max(1, Math.floor(Number(e.target.value)) || 1) }))}
                              min="1"
                              aria-label={`Cantidad de ${item.name}`}
                              className="h-8 rounded-lg text-xs font-bold mt-0.5"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
            {canEdit && <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Guardando..." : "Guardar y abrir expediente"}
            </Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
