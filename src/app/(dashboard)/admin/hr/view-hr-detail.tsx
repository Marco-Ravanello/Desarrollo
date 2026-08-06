"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Calendar, CreditCard, FileText, Info, Clock, Hash } from "lucide-react";

export function ViewHRDetail({ agent }: { agent: any }) {
  if (!agent) return null;

  return (
    <div className="space-y-8 py-4">
      <div className="flex flex-col items-center text-center space-y-4">
        <Avatar className="h-28 w-24 border-4 border-blue-50 shadow-xl rounded-2xl">
          <AvatarImage src={agent.imageUrl || ""} alt={agent.firstName} className="object-cover" />
          <AvatarFallback className="bg-blue-600 text-white font-black text-3xl">
            {agent.firstName?.[0]}{agent.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-2xl font-black text-slate-900">{agent.firstName} {agent.lastName}</h3>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">DNI {agent.dni} • Legajo/CUIT {agent.fileNumber || 'N/A'}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Badge className={`rounded-full px-4 py-1 text-xs font-black tracking-widest border-none ${
            agent.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600' :
            agent.status === 'LICENCIA' ? 'bg-amber-50 text-amber-600' :
            agent.status === 'VACACIONES' ? 'bg-blue-50 text-blue-600' :
            'bg-rose-50 text-rose-600'
          }`}>
            {agent.status || 'ACTIVO'}
          </Badge>
          {agent.statusUntil && (
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter flex items-center gap-1">
              <Info className="h-3 w-3" /> Hasta el {new Date(agent.statusUntil).toLocaleDateString('es-AR')}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-slate-50 rounded-2xl p-4 space-y-4 border border-slate-100">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Briefcase className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Cargo y Área</p>
                <p className="text-sm font-bold text-slate-900 leading-tight">{agent.position} en {agent.area?.name || "Sin Área"}</p>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Fecha de Ingreso</p>
                <p className="text-sm font-bold text-slate-900">{agent.startDate ? new Date(agent.startDate).toLocaleDateString('es-AR') : 'No registrada'}</p>
              </div>
           </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 space-y-4 border border-slate-100">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Clock className="h-4 w-4 text-[#f5a623]" />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Horario Cumplido</p>
                <p className="text-sm font-bold text-slate-900">{agent.schedule || 'No registrado'}</p>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Hash className="h-4 w-4 text-[#f5a623]" />
              </div>
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Categoría</p>
                <p className="text-sm font-bold text-slate-900">{agent.category ? `Categoría ${agent.category}` : 'N/A'}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tipo de Contrato</p>
                <p className="font-bold text-slate-900 uppercase tracking-tight">{agent.contractType?.replace('_', ' ') || 'MENSUALIZADO'}</p>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sueldo / Honorarios</p>
                <p className="font-bold text-slate-900">
                  ${(agent.salary || 0).toLocaleString('es-AR')}
                </p>
              </div>
           </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-blue-600" /> Tareas y Responsabilidades
        </h4>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
           <p className="text-sm text-slate-600 leading-relaxed italic">
             {agent.tasks || "No se han detallado tareas para este agente."}
           </p>
        </div>
      </div>

      <div className="pt-4 pb-10">
        <Button variant="outline" className="w-full rounded-xl h-12 border-slate-200 font-bold hover:bg-slate-50">
           Descargar Ficha Completa (PDF)
        </Button>
      </div>
    </div>
  );
}
