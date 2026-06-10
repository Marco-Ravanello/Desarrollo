"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createHRRecordAction } from "../actions/hr-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";

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
    <form onSubmit={handleSubmit} className="space-y-8 py-4">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="font-bold text-slate-700">Nombre</Label>
          <Input id="firstName" name="firstName" placeholder="Nombre" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName" className="font-bold text-slate-700">Apellido</Label>
          <Input id="lastName" name="lastName" placeholder="Apellido" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="dni" className="font-bold text-slate-700">DNI</Label>
          <Input id="dni" name="dni" placeholder="DNI" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fileNumber" className="font-bold text-slate-700">N° de Legajo</Label>
          <Input id="fileNumber" name="fileNumber" placeholder="N° de legajo" className="rounded-xl h-11 bg-slate-50 border-slate-200" />
        </div>
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="position" className="font-bold text-slate-700">Cargo / Función</Label>
        <Input id="position" name="position" placeholder="Cargo o función" className="rounded-xl h-11 bg-slate-50 border-slate-200" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate" className="font-bold text-slate-700">Fecha de Ingreso</Label>
        <Input id="startDate" name="startDate" type="date" className="rounded-xl h-11 bg-slate-50 border-slate-200" />
      </div>

      <div className="flex flex-col gap-3 pt-6">
        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-600/20" disabled={loading}>
          {loading ? "Guardando..." : "Guardar Legajo"}
        </Button>
      </div>
    </form>
  );
}
