"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createHRRecordAction } from "../actions/hr-actions";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";

export function CreateHRForm({ areas }: { areas: any[] }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("ACTIVO");
  const [contractType, setContractType] = useState("MENSUALIZADO");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await createHRRecordAction(formData);
    if (res.success) {
      toast.success("Legajo creado correctamente");
      (e.target as HTMLFormElement).reset();
      setStatus("ACTIVO");
      setContractType("MENSUALIZADO");
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-[#004a80]">Información Personal</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="font-bold text-slate-700">Nombre</Label>
            <Input id="firstName" name="firstName" placeholder="Nombre" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-bold text-slate-700">Apellido</Label>
            <Input id="lastName" name="lastName" placeholder="Apellido" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dni" className="font-bold text-slate-700">DNI</Label>
            <Input id="dni" name="dni" placeholder="DNI" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileNumber" className="font-bold text-slate-700">N° Legajo / CUIT</Label>
            <Input id="fileNumber" name="fileNumber" placeholder="Legajo o CUIT" />
          </div>
        </div>
        <div className="space-y-2">
            <Label htmlFor="imageUrl" className="font-bold text-slate-700">URL de Foto de Perfil (Opcional)</Label>
            <Input id="imageUrl" name="imageUrl" placeholder="https://..." />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-[#004a80]">Situación Revista</h4>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">Área de Pertenencia</Label>
          <Combobox
            name="areaId"
            placeholder="Seleccionar área..."
            options={(areas || []).map(a => ({ value: a.id, label: a.name }))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="position" className="font-bold text-slate-700">Cargo / Función</Label>
            <Input id="position" name="position" placeholder="Ej: Administrativo" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate" className="font-bold text-slate-700">Fecha de Ingreso</Label>
            <Input id="startDate" name="startDate" type="date" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status" className="font-bold text-slate-700">Estado Actual</Label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              required
            >
              <option value="ACTIVO">Activo</option>
              <option value="LICENCIA">Licencia</option>
              <option value="VACACIONES">Vacaciones</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>
          {(status === "LICENCIA" || status === "VACACIONES") && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <Label htmlFor="statusUntil" className="font-bold text-slate-700">Hasta el día</Label>
              <Input id="statusUntil" name="statusUntil" type="date" className="bg-blue-50 border-blue-200" required />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contractType" className="font-bold text-slate-700">Tipo de Contrato</Label>
            <select
              id="contractType"
              name="contractType"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              required
            >
              <option value="MENSUALIZADO">Mensualizado</option>
              <option value="MONOTRIBUTISTA">Monotributista</option>
              <option value="PLANTA_PERMANENTE">Planta Permanente</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="salary" className="font-bold text-slate-700">Sueldo / Honorarios</Label>
            <Input id="salary" name="salary" type="number" placeholder="0.00" />
          </div>
        </div>

        {contractType === "MENSUALIZADO" && (
           <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <Label htmlFor="category" className="font-bold text-slate-700">Categoría</Label>
              <select name="category" id="category" className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-all">
                 <option value="">Seleccionar Categoría</option>
                 {[...Array(10)].map((_, i) => (
                    <option key={i+1} value={i+1}>Categoría {i+1}</option>
                 ))}
              </select>
           </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="schedule" className="font-bold text-slate-700">Horario Cumplido</Label>
            <Input id="schedule" name="schedule" placeholder="Ej: 08:00 a 14:00" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="tasks" className="font-bold text-slate-700">Tareas y Responsabilidades</Label>
            <textarea
            id="tasks"
            name="tasks"
            rows={3}
            placeholder="Describa las tareas que realiza el agente..."
            className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4 pb-10">
        <Button type="submit" className="w-full bg-[#004a80] hover:bg-[#00365d] text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-900/20" disabled={loading}>
          {loading ? "Guardando..." : "Registrar Agente"}
        </Button>
      </div>
    </form>
  );
}
