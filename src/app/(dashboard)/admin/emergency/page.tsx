"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CloudRain, ShieldAlert, AlertTriangle, Phone, Users,
  Home, Package, Plus, CheckCircle2, Waves, Radio, MapPin,
  Clock, Flame, Truck, Activity
} from "lucide-react";

export default function EmergencyOperationsPage() {
  const [isEmergencyActive, setIsEmergencyActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"shelters" | "stock" | "incidents" | "protocols">("shelters");

  const [shelters, setShelters] = useState([
    {
      id: 1,
      name: "Polideportivo Municipal N° 1",
      address: "Av. San Martín y Belgrano",
      coordinator: "Lic. Andrea Gómez (11-4567-8901)",
      capacity: 60,
      occupied: 28,
      rationsDelivered: 84,
      status: "HABILITADO",
    },
    {
      id: 2,
      name: "Club Social y Deportivo Barrio Norte",
      address: "Calle Los Pinos 1420",
      coordinator: "Prof. Marcos Díaz (11-3456-7890)",
      capacity: 40,
      occupied: 14,
      rationsDelivered: 42,
      status: "HABILITADO",
    },
    {
      id: 3,
      name: "Escuela Primaria N° 12 (Reserva)",
      address: "Rivadavia 850",
      coordinator: "Directora Laura Pérez (11-2345-6789)",
      capacity: 50,
      occupied: 0,
      rationsDelivered: 0,
      status: "EN_GUARDIA",
    },
  ]);

  const [emergencyStock, setEmergencyStock] = useState([
    { id: 1, name: "Colchones Ignífugos", quantity: 180, minNeeded: 100, unit: "unidades", status: "OPTIMO" },
    { id: 2, name: "Frazadas y Mantas Térmicas", quantity: 350, minNeeded: 200, unit: "unidades", status: "OPTIMO" },
    { id: 3, name: "Bidones de Agua Mineral (5L)", quantity: 1200, minNeeded: 500, unit: "litros", status: "OPTIMO" },
    { id: 4, name: "Kits de Alimentos No Perecederos", quantity: 420, minNeeded: 150, unit: "bolsas", status: "OPTIMO" },
    { id: 5, name: "Chapas Acanaladas Zinc (Sinusoidal)", quantity: 85, minNeeded: 100, unit: "chapas", status: "CRITICO" },
    { id: 6, name: "Tirantes de Madera (3x2x4m)", quantity: 140, minNeeded: 120, unit: "tirantes", status: "OPTIMO" },
    { id: 7, name: "Botas de Goma y Capas de Lluvia", quantity: 65, minNeeded: 80, unit: "pares", status: "CRITICO" },
  ]);

  const [incidents, setIncidents] = useState([
    {
      id: 1,
      neighborhood: "Barrio San Jorge",
      address: "Calle Los Álamos 450",
      type: "Ingreso de Agua en Vivienda",
      priority: "ALTA",
      affectedPeople: 5,
      time: "Hace 15 min",
      status: "EN_CURSO",
      squad: "Cuadrilla Social Sur #2",
    },
    {
      id: 2,
      neighborhood: "Barrio La Ribera",
      address: "Costanera y Arroyo",
      type: "Evacuación Preventiva",
      priority: "CRITICA",
      affectedPeople: 8,
      time: "Hace 32 min",
      status: "EN_CURSO",
      squad: "Defensa Civil + Móvil 04",
    },
    {
      id: 3,
      neighborhood: "Villa Esperanza",
      address: "Manzana 4, Lote 12",
      type: "Desprendimiento de Techo",
      priority: "MEDIA",
      affectedPeople: 4,
      time: "Hace 1 hora",
      status: "ASISTIDO",
      squad: "Hábitat Cuadrilla #1",
    },
  ]);

  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newType, setNewType] = useState("Ingreso de Agua");
  const [newPriority, setNewPriority] = useState("ALTA");
  const [newPeople, setNewPeople] = useState("4");

  useEffect(() => {
    const saved = localStorage.getItem("emergency-mode-active");
    if (saved) setIsEmergencyActive(JSON.parse(saved));
  }, []);

  const handleToggleEmergency = () => {
    const nextState = !isEmergencyActive;
    setIsEmergencyActive(nextState);
    localStorage.setItem("emergency-mode-active", JSON.stringify(nextState));
    window.dispatchEvent(new Event("emergency-toggle"));

    if (nextState) {
      toast.error("🚨 PROTOCOLO DE EMERGENCIA CLIMÁTICA ACTIVADO");
    } else {
      toast.success("Protocolo de Emergencia Desactivado");
    }
  };

  const handleAddIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNeighborhood || !newAddress) {
      toast.error("Por favor complete el barrio y dirección");
      return;
    }

    const newInc = {
      id: Date.now(),
      neighborhood: newNeighborhood,
      address: newAddress,
      type: newType,
      priority: newPriority,
      affectedPeople: Number(newPeople) || 1,
      time: "Recién",
      status: "EN_CURSO",
      squad: "Asignando cuadrilla...",
    };

    setIncidents([newInc, ...incidents]);
    setNewNeighborhood("");
    setNewAddress("");
    toast.success("Alerta de emergencia registrada y despachada");
  };

  const handleDispatchStock = (item: any) => {
    if (item.quantity <= 0) {
      toast.error("No hay stock disponible para despachar");
      return;
    }
    setEmergencyStock(emergencyStock.map(s => s.id === item.id ? { ...s, quantity: Math.max(0, s.quantity - 10) } : s));
    toast.success(`Se despacharon 10 ${item.unit} de ${item.name} a territorio`);
  };

  const totalCapacity = shelters.reduce((a, b) => a + b.capacity, 0);
  const totalOccupied = shelters.reduce((a, b) => a + b.occupied, 0);
  const totalFree = totalCapacity - totalOccupied;
  const occupancyPercentage = Math.round((totalOccupied / totalCapacity) * 100);

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white p-8 rounded-[2.5rem] border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <ShieldAlert className="h-8 w-8 animate-pulse" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">Centro de Operaciones de Emergencia Climática (COE)</h2>
                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                  Dirección General de Desarrollo Humano • Defensa Civil • Hábitat
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleToggleEmergency}
            className={`font-black text-xs uppercase tracking-widest px-6 h-12 rounded-2xl shadow-lg transition-all ${
              isEmergencyActive
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isEmergencyActive ? "🚨 Desactivar Modo Crisis" : "⚡ Activar Protocolo Temporal"}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <Phone className="h-4 w-4 text-amber-400" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Defensa Civil</p>
              <p className="text-sm font-black text-white">Línea 103</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <Flame className="h-4 w-4 text-rose-400" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Bomberos Voluntarios</p>
              <p className="text-sm font-black text-white">Línea 100</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <Activity className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">SAME / Médicas</p>
              <p className="text-sm font-black text-white">Línea 107</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <Radio className="h-4 w-4 text-blue-400" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Guardia Social</p>
              <p className="text-sm font-black text-white">Interno 2244</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Centros de Evacuados</span>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><Home className="h-4 w-4" /></div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{totalOccupied} / {totalCapacity}</p>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">{totalFree} plazas libres disponibles</p>
            </div>
            <Progress value={occupancyPercentage} className="h-2 bg-blue-500/10 [&>div]:bg-blue-600" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Incidentes Reportados</span>
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl"><AlertTriangle className="h-4 w-4" /></div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{incidents.length} Alertas</p>
              <p className="text-xs text-rose-500 font-bold mt-0.5">{incidents.filter(i => i.status === 'EN_CURSO').length} en intervención activa</p>
            </div>
            <Progress value={65} className="h-2 bg-rose-500/10 [&>div]:bg-rose-500" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Stock de Contingencia</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl"><Package className="h-4 w-4" /></div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">7 Rubros Clave</p>
              <p className="text-xs text-amber-500 font-bold mt-0.5">2 en nivel de reposición</p>
            </div>
            <Progress value={85} className="h-2 bg-emerald-500/10 [&>div]:bg-emerald-500" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Cuadrillas Desplegadas</span>
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl"><Truck className="h-4 w-4" /></div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">4 Equipos en Calle</p>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">Sur, Ribera, Oeste y Centro</p>
            </div>
            <Progress value={100} className="h-2 bg-purple-500/10 [&>div]:bg-purple-600" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50 max-w-2xl">
        <button
          onClick={() => setActiveTab("shelters")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "shelters" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Centros de Evacuados ({shelters.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "stock" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Stock de Crisis</span>
        </button>
        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "incidents" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span>Alertas en Territorio ({incidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("protocols")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "protocols" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-4 w-4" />
          <span>Protocolos</span>
        </button>
      </div>

      {activeTab === "shelters" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {shelters.map((shelter) => {
            const pct = Math.round((shelter.occupied / shelter.capacity) * 100);
            return (
              <Card key={shelter.id} className="rounded-3xl border-border/60 shadow-sm bg-card flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge className={`text-[10px] font-black uppercase ${
                      shelter.status === 'HABILITADO' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    }`}>
                      {shelter.status}
                    </Badge>
                    <span className="text-xs font-black text-foreground">{pct}% OCUPADO</span>
                  </div>
                  <CardTitle className="text-lg font-black text-foreground mt-2">{shelter.name}</CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {shelter.address}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted-foreground">Camas Ocupadas:</span>
                      <span className="font-black text-foreground">{shelter.occupied} de {shelter.capacity}</span>
                    </div>
                    <Progress value={pct} className="h-2.5 bg-muted [&>div]:bg-primary" />
                  </div>

                  <div className="bg-muted/30 p-3.5 rounded-2xl space-y-1.5 text-xs">
                    <p className="font-bold text-muted-foreground uppercase text-[10px]">Coordinador de Centro</p>
                    <p className="font-bold text-foreground">{shelter.coordinator}</p>
                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      🍽️ Viandas y Raciones: <b className="text-foreground">{shelter.rationsDelivered} entregadas</b>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-xl text-xs font-bold"
                      onClick={() => {
                        setShelters(shelters.map(s => s.id === shelter.id ? { ...s, occupied: Math.min(s.capacity, s.occupied + 1), rationsDelivered: s.rationsDelivered + 3 } : s));
                        toast.success(`Se registró el ingreso de 1 persona a ${shelter.name}`);
                      }}
                    >
                      + Ingresar Persona
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-xs font-bold text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setShelters(shelters.map(s => s.id === shelter.id ? { ...s, occupied: Math.max(0, s.occupied - 1) } : s));
                        toast.info(`Se registró el egreso de 1 persona`);
                      }}
                    >
                      - Egreso
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === "stock" && (
        <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-6 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-foreground">Inventario de Contingencia Crítica</h3>
              <p className="text-xs text-muted-foreground font-medium">Materiales y víveres para respuesta inmediata ante temporal</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-none font-bold text-xs">Depósito Central</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[10px] font-black text-muted-foreground uppercase tracking-wider text-left">
                  <th className="py-3 px-4">Insumo de Emergencia</th>
                  <th className="py-3 px-4 text-center">Disponible</th>
                  <th className="py-3 px-4 text-center">Mínimo Crítico</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acción Rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {emergencyStock.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="py-4 px-4 font-bold text-foreground">{item.name}</td>
                    <td className="py-4 px-4 text-center font-black text-base text-foreground tabular-nums">
                      {item.quantity} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                    </td>
                    <td className="py-4 px-4 text-center text-xs text-muted-foreground font-semibold tabular-nums">
                      {item.minNeeded} {item.unit}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge className={`text-[10px] font-bold uppercase ${
                        item.status === 'OPTIMO' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                      }`}>
                        {item.status === 'OPTIMO' ? 'Abastecido' : 'Nivel Bajo'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs font-bold hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handleDispatchStock(item)}
                      >
                        🚚 Despachar a Territorio
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-black text-foreground">Alertas Activas en Territorio</h3>
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div key={inc.id} className="p-5 rounded-3xl bg-card border border-border/60 shadow-sm flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] font-black uppercase ${
                        inc.priority === 'CRITICA' ? 'bg-rose-500/15 text-rose-500 border-rose-500/30' :
                        inc.priority === 'ALTA' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
                        'bg-blue-500/15 text-blue-500 border-blue-500/30'
                      }`}>
                        Prioridad {inc.priority}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-semibold">
                        <Clock className="h-3 w-3" /> {inc.time}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-foreground">{inc.type} en {inc.neighborhood}</h4>
                      <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {inc.address} • <b>{inc.affectedPeople} personas afectadas</b>
                      </p>
                    </div>

                    <p className="text-xs text-primary font-bold flex items-center gap-1.5 pt-1">
                      <Truck className="h-3.5 w-3.5" /> {inc.squad}
                    </p>
                  </div>

                  <div className="text-right">
                    {inc.status === 'EN_CURSO' ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                        onClick={() => {
                          setIncidents(incidents.map(i => i.id === inc.id ? { ...i, status: "RESUELTO" } : i));
                          toast.success("Incidente marcado como asistido y resuelto");
                        }}
                      >
                        ✓ Marcar Asistido
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-none text-xs font-bold">
                        Resuelto
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card p-6 rounded-3xl border border-border/60 shadow-sm space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Cargar Nueva Alerta</h3>
                <p className="text-[11px] text-muted-foreground font-medium">Despacho directo a cuadrillas</p>
              </div>
            </div>

            <form onSubmit={handleAddIncident} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Barrio / Localidad</Label>
                <Input
                  placeholder="Ej: Barrio San Jorge"
                  value={newNeighborhood}
                  onChange={(e) => setNewNeighborhood(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Dirección Exacta</Label>
                <Input
                  placeholder="Ej: Calle Los Pinos 450"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Tipo de Emergencia</Label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium"
                  >
                    <option value="Ingreso de Agua">Ingreso de Agua</option>
                    <option value="Evacuación Inmediata">Evacuación Inmediata</option>
                    <option value="Techo Volado / Dañado">Techo Volado / Dañado</option>
                    <option value="Árbol o Poste Caído">Árbol o Poste Caído</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Prioridad</Label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium"
                  >
                    <option value="CRITICA">🔴 Crítica</option>
                    <option value="ALTA">🟡 Alta</option>
                    <option value="MEDIA">🔵 Media</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Personas / Niños Afectados</Label>
                <Input
                  type="number"
                  placeholder="Ej: 5"
                  value={newPeople}
                  onChange={(e) => setNewPeople(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <Button type="submit" className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20">
                🚨 Despachar Alerta a Cuadrilla
              </Button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "protocols" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
          <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Protocolo de Actuación ante Tormenta
            </h3>
            <ul className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="font-black text-primary">1.</span>
                <span><b>Alerta Temprana SMN:</b> Notificación a cuadrillas de guardia y verificación de stock crítico de frazadas y chapas.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-black text-primary">2.</span>
                <span><b>Apertura de Centros:</b> Habilitación inmediata de Polideportivo Municipal N° 1 y Club Barrio Norte.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-black text-primary">3.</span>
                <span><b>Despliegue Territorial:</b> Móviles 04 y 06 recorren cuencas y arroyos en busca de familias en riesgo.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-black text-primary">4.</span>
                <span><b>Asistencia Post-Tormenta:</b> Carga de solicitudes de chapas y tirantes en el sistema para entrega en 24hs.</span>
              </li>
            </ul>
          </Card>

          <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Radio className="h-5 w-5 text-blue-500" /> Directorio de Enlace de Emergencias
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="font-bold text-foreground">Defensa Civil Central</p>
                  <p className="text-[11px] text-muted-foreground">Coordinador: Comandante Rossi</p>
                </div>
                <Badge className="bg-blue-500/10 text-blue-500 font-bold border-none">103 / 4222-1100</Badge>
              </div>

              <div className="flex justify-between items-center p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="font-bold text-foreground">Secretaría de Servicios Públicos</p>
                  <p className="text-[11px] text-muted-foreground">Guardia de Desobstrucción y Bombas</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 font-bold border-none">Interno 105</Badge>
              </div>

              <div className="flex justify-between items-center p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="font-bold text-foreground">Hospital Municipal / SAME</p>
                  <p className="text-[11px] text-muted-foreground">Guardia de Traumatología y Pediatría</p>
                </div>
                <Badge className="bg-rose-500/10 text-rose-500 font-bold border-none">107 / 4222-9900</Badge>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
