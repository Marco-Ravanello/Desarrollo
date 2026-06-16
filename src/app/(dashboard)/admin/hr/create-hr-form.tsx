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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await createHRRecordAction(formData);
    if (res.success) {
      toast.success("Legajo creado correctamente");
      (e.target as HTMLFormElement).reset();
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-blue-600">Información Personal</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="font-bold text-slate-700">Nombre</Label>
            <Input id="firstName" name="firstName" placeholder="Nombre" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-bold text-slate-700">Apellido</Label>
            <Input id="lastName" name="lastName" placeholder="Apellido" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dni" className="font-bold text-slate-700">DNI</Label>
            <Input id="dni" name="dni" placeholder="DNI" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileNumber" className="font-bold text-slate-700">N° de Legajo</Label>
            <Input id="fileNumber" name="fileNumber" placeholder="Ej: 4502" className="rounded-xl h-11 bg-slate-50 border-slate-200" />
          </div>
        </div>
      </div>

      <Separator className="bg-slate-100" />

      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-blue-600">Situación Revista</h4>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">Área de Pertenencia</Label>
          <Combobox
            name="areaId"
            placeholder="Seleccionar área..."
            options={(areas || []).map(a => ({ value: a.id, label: a.name }))}
            className="rounded-xl h-11 bg-slate-50 border-slate-200 w-full"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="position" className="font-bold text-slate-700">Cargo / Función</Label>
            <Input id="position" name="position" placeholder="Ej: Administrativo" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate" className="font-bold text-slate-700">Fecha de Ingreso</Label>
            <Input id="startDate" name="startDate" type="date" className="rounded-xl h-11 bg-slate-50 border-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contractType" className="font-bold text-slate-700">Tipo de Contrato</Label>
            <select
              id="contractType"
              name="contractType"
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              <option value="MENSUALIZADO">Mensualizado</option>
              <option value="MONOTRIBUTISTA">Monotributista</option>
              <option value="PLANTA_PERMANENTE">Planta Permanente</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="salary" className="font-bold text-slate-700">Sueldo / Honorarios</Label>
            <Input id="salary" name="salary" type="number" placeholder="0.00" className="rounded-xl h-11 bg-slate-50 border-slate-200" />
          </div>
        </div>
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

      <div className="flex flex-col gap-3 pt-4 pb-10">
        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-600/20" disabled={loading}>
          {loading ? "Guardando..." : "Registrar Agente"}
        </Button>
      </div>
    </form>
  );
}
