"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase, Calendar, CreditCard, FileText, Info, Clock, Hash,
  HeartPulse, GraduationCap, Car, ShieldCheck, Sparkles, User
} from "lucide-react";

export function ViewHRDetail({ agent }: { agent: any }) {
  const [activeTab, setActiveTab] = useState<"general" | "health" | "education" | "driving">("general");

  if (!agent) return null;

  const formatCurrency = (val?: number | string) => {
    if (!val || Number(val) === 0) return "$0";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(val));
  };

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return "No registrada";
    return new Date(dateStr).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col items-center text-center space-y-3 bg-muted/20 p-6 rounded-3xl border border-border/50">
        <Avatar className="h-28 w-24 border-4 border-background shadow-xl rounded-2xl">
          <AvatarImage src={agent.imageUrl || ""} alt={agent.firstName} className="object-cover" />
          <AvatarFallback className="bg-primary text-primary-foreground font-black text-3xl">
            {agent.firstName?.[0]}{agent.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-2xl font-black text-foreground">{agent.firstName} {agent.lastName}</h3>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
            DNI {agent.dni} • Legajo #{agent.fileNumber || 'S/L'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={`rounded-full px-3.5 py-1 text-xs font-black tracking-wider border-none ${
            agent.status === 'ACTIVO' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
            agent.status === 'LICENCIA' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
            agent.status === 'VACACIONES' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
            'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}>
            {agent.status || 'ACTIVO'}
          </Badge>
          {agent.statusUntil && (
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3 text-amber-400" /> Hasta el {formatDate(agent.statusUntil)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded-2xl border border-border/50">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "general" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">General</span>
        </button>
        <button
          onClick={() => setActiveTab("health")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "health" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <HeartPulse className="h-3.5 w-3.5 text-rose-400" />
          <span className="hidden sm:inline">Salud</span>
        </button>
        <button
          onClick={() => setActiveTab("education")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "education" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
          <span className="hidden sm:inline">Títulos</span>
        </button>
        <button
          onClick={() => setActiveTab("driving")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "driving" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Car className="h-3.5 w-3.5 text-teal-400" />
          <span className="hidden sm:inline">Conducción</span>
        </button>
      </div>

      {activeTab === "general" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-card/50 rounded-2xl p-4 space-y-3 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cargo y Área</p>
                  <p className="text-sm font-bold text-foreground">{agent.position || "Operativo"} en {agent.area?.name || "Sin Área"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fecha de Ingreso</p>
                  <p className="text-sm font-bold text-foreground">{formatDate(agent.startDate)}</p>
                </div>
              </div>
            </div>

            <div className="bg-card/50 rounded-2xl p-4 space-y-3 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Horario Cumplido</p>
                  <p className="text-sm font-bold text-foreground">{agent.schedule || "Sin registrar"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Hash className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Categoría</p>
                  <p className="text-sm font-bold text-foreground">{agent.category ? `Categoría ${agent.category}` : 'Sin categoría asignada'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card/50 rounded-2xl p-4 space-y-3 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tipo de Contrato</p>
                  <p className="text-sm font-bold text-foreground uppercase">{agent.contractType?.replace('_', ' ') || 'MENSUALIZADO'}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Haber Mensual</p>
                <p className="text-base font-black text-emerald-400">{formatCurrency(agent.salary)}</p>
              </div>
            </div>
          </div>

          <div className="bg-card/50 rounded-2xl p-4 space-y-2 border border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Tareas, Capacitaciones y Habilitaciones
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              {agent.tasks || "No se registraron observaciones o tareas detalladas para este legajo."}
            </p>
          </div>
        </div>
      )}

      {activeTab === "health" && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs font-bold text-foreground">Aptitud Física de Perfil</p>
                <p className="text-[10px] text-muted-foreground">Examen pre-ocupacional / periódico municipal</p>
              </div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold">
              {agent.status === 'LICENCIA' ? 'En Licencia' : 'Apto'}
            </Badge>
          </div>

          <div className="p-4 rounded-2xl bg-card/40 border border-border/40 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Detalle de Licencias o Salud</p>
            <p className="text-xs text-muted-foreground">
              {agent.status === 'LICENCIA'
                ? `Agente en licencia médica ${agent.statusUntil ? `hasta el ${formatDate(agent.statusUntil)}` : ''}.`
                : agent.tasks?.toLowerCase().includes("salud") || agent.tasks?.toLowerCase().includes("médic")
                ? agent.tasks
                : "Sin carpetas médicas o licencias por enfermedad activas en el período actual."}
            </p>
          </div>
        </div>
      )}

      {activeTab === "education" && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="p-4 rounded-2xl bg-card/40 border border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-xs font-bold text-foreground">Nivel Académico y Formación</p>
                <p className="text-[10px] text-muted-foreground">Documentación y certificaciones acreditadas</p>
              </div>
            </div>
            <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] uppercase font-bold">
              Registrado
            </Badge>
          </div>

          <div className="p-4 rounded-2xl bg-card/40 border border-border/40 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Acreditaciones Registradas en el Legajo</p>
            <p className="text-xs text-muted-foreground">
              {agent.tasks?.toLowerCase().includes("título") || agent.tasks?.toLowerCase().includes("curso") || agent.tasks?.toLowerCase().includes("capacita")
                ? agent.tasks
                : "Se registran títulos y certificados entregados en la oficina de Recursos Humanos."}
            </p>
          </div>
        </div>
      )}

      {activeTab === "driving" && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-teal-400" />
              <div>
                <p className="text-xs font-bold text-foreground">Habilitación de Conducción de Vehículos</p>
                <p className="text-[10px] text-muted-foreground">Permiso para uso de unidades de la flota logística</p>
              </div>
            </div>
            <Badge className="bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] uppercase font-bold">
              {agent.tasks?.toLowerCase().includes("licencia") || agent.tasks?.toLowerCase().includes("conduc") ? "Habilitado" : "Regular"}
            </Badge>
          </div>

          <div className="p-4 rounded-2xl bg-card/40 border border-border/40 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Observaciones de Conducción</p>
            <p className="text-xs text-muted-foreground">
              {agent.tasks?.toLowerCase().includes("licencia") || agent.tasks?.toLowerCase().includes("conduc")
                ? agent.tasks
                : "Licencia de conducir estándar o legajo sin habilitación especial asignada."}
            </p>
          </div>
        </div>
      )}

      <div className="pt-2 pb-6">
        <Button variant="outline" className="w-full rounded-xl h-11 border-border font-bold hover:bg-accent text-xs">
          Descargar Ficha del Legajo Digital (PDF)
        </Button>
      </div>
    </div>
  );
}
