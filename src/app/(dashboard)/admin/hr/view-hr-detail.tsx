"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Briefcase, Calendar, CreditCard, FileText, User } from "lucide-react";

export function ViewHRDetail({ agent }: { agent: any }) {
  if (!agent) return null;

  // Handle Prisma Decimal safely
  const formattedSalary = agent.salary
    ? (typeof agent.salary === 'object' && 'toNumber' in agent.salary
        ? agent.salary.toNumber()
        : parseFloat(agent.salary.toString()))
    : 0;

  return (
    <div className="space-y-8 py-4">
      <div className="flex flex-col items-center text-center space-y-4">
        <Avatar className="h-24 w-24 border-4 border-blue-50 shadow-xl">
          <AvatarFallback className="bg-blue-600 text-white font-black text-2xl">
            {agent.firstName?.[0] || '?'}{agent.lastName?.[0] || ''}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-2xl font-black text-slate-900">{agent.firstName} {agent.lastName}</h3>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">DNI {agent.dni} • Legajo {agent.fileNumber || 'N/A'}</p>
        </div>
        <Badge className={`rounded-full px-4 py-1 text-xs font-black tracking-widest border-none ${
          agent.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600' :
          agent.status === 'LICENCIA' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {agent.status || 'ACTIVO'}
        </Badge>
      </div>

      <div className="grid gap-6">
        <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Briefcase className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cargo y Área</p>
                <p className="font-bold text-slate-900">{agent.position || 'No definido'} en {agent.area?.name || "Sin Área"}</p>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha de Ingreso</p>
                <p className="font-bold text-slate-900">{agent.startDate ? new Date(agent.startDate).toLocaleDateString('es-AR') : 'No registrada'}</p>
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
                <p className="font-bold text-slate-900">${formattedSalary.toLocaleString('es-AR')}</p>
              </div>
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
