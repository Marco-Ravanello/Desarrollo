"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ShieldAlert, AlertTriangle, Phone,
  Home, Package, Plus, Radio, MapPin,
  Flame, Truck, Activity
} from "lucide-react";
import Link from "next/link";

interface EmergencyViewProps {
  initialData: {
    incidents: Array<{
      id: string;
      neighborhood: string;
      address: string;
      type: string;
      priority: string;
      affectedPeople: number;
      time: string;
      status: string;
      squad: string;
      personName?: string | null;
      personDni?: string | null;
    }>;
    emergencyStock: Array<{
      id: string;
      name: string;
      quantity: number;
      minNeeded: number;
      unit: string;
      status: string;
      areaName: string;
    }>;
    availableVehiclesCount: number;
  };
}

export function EmergencyView({ initialData }: EmergencyViewProps) {
  const [isEmergencyActive, setIsEmergencyActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"shelters" | "stock" | "incidents" | "protocols">("shelters");

  const [shelters, setShelters] = useState([
    {
      id: "1",
      name: "Polideportivo Municipal N° 1",
      address: "Av. San Martín y Belgrano",
      coordinator: "Lic. Andrea Gómez (11-4567-8901)",
      capacity: 60,
      occupied: 28,
      rationsDelivered: 84,
      status: "HABILITADO",
    },
    {
      id: "2",
      name: "Club Social y Deportivo Barrio Norte",
      address: "Calle Los Pinos 1420",
      coordinator: "Prof. Marcos Díaz (11-3456-7890)",
      capacity: 40,
      occupied: 14,
      rationsDelivered: 42,
      status: "HABILITADO",
    },
    {
      id: "3",
      name: "Escuela Primaria N° 12 (Reserva)",
      address: "Rivadavia 850",
      coordinator: "Directora Laura Pérez (11-2345-6789)",
      capacity: 50,
      occupied: 0,
      rationsDelivered: 0,
      status: "EN_GUARDIA",
    },
  ]);

  const [emergencyStock, setEmergencyStock] = useState(initialData.emergencyStock);
  const [incidents, setIncidents] = useState(initialData.incidents);

  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newType, setNewType] = useState("Ingreso de Agua en Vivienda");
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
    localStorage.setItem("muni-emergency-mode", JSON.stringify(nextState));
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
      id: `incident-${Date.now()}`,
      neighborhood: newNeighborhood,
      address: newAddress,
      type: newType,
      priority: newPriority,
      affectedPeople: Number(newPeople) || 1,
      time: "Recién",
      status: "EN_CURSO",
      squad: "Defensa Civil + Guardia Territorial",
      personName: "Reporte Directo COE",
      personDni: null
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
    setEmergencyStock(
      emergencyStock.map((s) =>
        s.id === item.id ? { ...s, quantity: Math.max(0, s.quantity - 10) } : s
      )
    );
    toast.success(`Se despacharon 10 ${item.unit} de ${item.name} a territorio`);
  };

  const totalCapacity = shelters.reduce((a, b) => a + b.capacity, 0);
  const totalOccupied = shelters.reduce((a, b) => a + b.occupied, 0);
  const totalFree = totalCapacity - totalOccupied;
  const occupancyPercentage = Math.round((totalOccupied / totalCapacity) * 100);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
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
            <Progress value={incidents.length > 0 ? Math.round((incidents.filter(i => i.status === 'EN_CURSO').length / incidents.length) * 100) : 0} className="h-2 bg-rose-500/10 [&>div]:bg-rose-500" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Stock de Contingencia</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl"><Package className="h-4 w-4" /></div>
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{emergencyStock.length} Rubros Clave</p>
              <p className="text-xs text-amber-500 font-bold mt-0.5">{emergencyStock.filter(s => s.status === 'CRITICO').length} en nivel de reposición</p>
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
              <p className="text-2xl font-black text-foreground">{initialData.availableVehiclesCount} Equipos en Calle</p>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">Sur, Ribera, Oeste y Centro</p>
            </div>
            <Progress value={90} className="h-2 bg-purple-500/10 [&>div]:bg-purple-600" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50 max-w-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab("shelters")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "shelters"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Centros de Evacuados ({shelters.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "incidents"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <span>Alertas en Territorio ({incidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "stock"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Stock de Crisis</span>
        </button>
      </div>

      {activeTab === "shelters" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {shelters.map((shelter) => {
            const percent = Math.round((shelter.occupied / shelter.capacity) * 100);
            return (
              <Card key={shelter.id} className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                    {shelter.status}
                  </Badge>
                  <span className="text-xs font-black text-foreground">{percent}% OCUPADO</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">{shelter.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> {shelter.address}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-muted-foreground">Camas Ocupadas:</span>
                    <span className="text-foreground">{shelter.occupied} de {shelter.capacity}</span>
                  </div>
                  <Progress value={percent} className="h-2" />
                </div>

                <div className="pt-3 border-t border-border/40 text-xs space-y-1 text-muted-foreground">
                  <p className="font-bold text-foreground">COORDINADOR DE CENTRO</p>
                  <p>{shelter.coordinator}</p>
                  <p className="text-[11px] mt-1 font-semibold text-primary">🍱 Viandas y Raciones: {shelter.rationsDelivered} entregadas</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Alertas y Casos Reales Registrados ({incidents.length})
            </h3>
            {incidents.length > 0 ? (
              incidents.map((inc) => (
                <Card key={inc.id} className="rounded-3xl border-border/60 shadow-sm bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] font-black uppercase border-none ${
                        inc.priority === 'CRITICA' || inc.priority === 'URGENTE' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-black'
                      }`}>
                        {inc.priority}
                      </Badge>
                      <span className="text-xs font-bold text-foreground">{inc.neighborhood}</span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-muted-foreground">{inc.time}</span>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-foreground">{inc.type}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" /> {inc.address}
                    </p>
                    {inc.personName && (
                      <p className="text-xs font-semibold text-primary mt-1">
                        Vecino Afectado: {inc.personName} {inc.personDni ? `(DNI ${inc.personDni})` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground font-semibold">
                      Asignado: <b className="text-foreground">{inc.squad}</b>
                    </span>
                    <Badge variant="outline" className="border-border text-foreground font-bold text-[10px]">
                      {inc.status}
                    </Badge>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground text-sm p-6 bg-card rounded-3xl border text-center">
                No hay incidentes reportados en la base de datos en este momento.
              </p>
            )}
          </div>

          <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Registrar Alerta Territorial
            </h3>

            <form onSubmit={handleAddIncident} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Barrio / Zona</Label>
                <Input
                  value={newNeighborhood}
                  onChange={(e) => setNewNeighborhood(e.target.value)}
                  placeholder="Ej: Barrio San Jorge"
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Dirección Exacta</Label>
                <Input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Ej: Calle Los Álamos 450"
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Tipo de Incidente</Label>
                <Input
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Ej: Ingreso de agua / Anegamiento"
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Prioridad</Label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full h-10 rounded-xl bg-background border border-border text-xs px-3 font-bold"
                  >
                    <option value="CRITICA">CRÍTICA</option>
                    <option value="ALTA">ALTA</option>
                    <option value="MEDIA">MEDIA</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Afectados</Label>
                  <Input
                    type="number"
                    value={newPeople}
                    onChange={(e) => setNewPeople(e.target.value)}
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl h-11 font-bold text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white mt-2"
              >
                Despachar Alerta a Guardia
              </Button>
            </form>
          </Card>
        </div>
      )}

      {activeTab === "stock" && (
        <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center border-b border-border/40 pb-4">
            <div>
              <h3 className="text-base font-black text-foreground">Inventario de Contingencia</h3>
              <p className="text-xs text-muted-foreground">Monitoreo y despacho rápido de materiales de emergencia.</p>
            </div>
            <Button asChild variant="outline" className="rounded-xl text-xs font-bold">
              <Link href="/admin/stock">+ Gestionar Depósito</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {emergencyStock.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] font-bold ${item.status === 'CRITICO' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'}`}>
                      {item.status}
                    </Badge>
                    <span className="text-[11px] font-bold text-muted-foreground">{item.areaName}</span>
                  </div>
                  <h4 className="text-sm font-black text-foreground mt-1">{item.name}</h4>
                  <p className="text-xs font-bold text-primary mt-0.5">{item.quantity} {item.unit} disponibles</p>
                </div>

                <Button
                  onClick={() => handleDispatchStock(item)}
                  size="sm"
                  className="rounded-xl font-bold text-xs bg-primary text-primary-foreground shrink-0"
                >
                  Despachar 10
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
