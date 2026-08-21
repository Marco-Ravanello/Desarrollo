"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        <h4 className="text-sm font-black uppercase tracking-widest text-primary">Información Personal</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="font-bold text-foreground">Nombre</Label>
            <Input id="firstName" name="firstName" placeholder="Nombre" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-bold text-foreground">Apellido</Label>
            <Input id="lastName" name="lastName" placeholder="Apellido" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dni" className="font-bold text-foreground">DNI</Label>
            <Input id="dni" name="dni" placeholder="Sin puntos" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileNumber" className="font-bold text-foreground">N° Legajo / CUIT</Label>
            <Input id="fileNumber" name="fileNumber" placeholder="Legajo municipal" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl" className="font-bold text-foreground">URL Foto de Perfil (Opcional)</Label>
          <Input id="imageUrl" name="imageUrl" placeholder="https://..." />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-primary">Situación Revista y Salarial</h4>

        <div className="space-y-2">
          <Label className="font-bold text-foreground">Área de Pertenencia</Label>
          <Combobox
            name="areaId"
            placeholder="Seleccionar área..."
            options={(areas || []).map(a => ({ value: a.id, label: a.name }))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="position" className="font-bold text-foreground">Cargo / Función</Label>
            <Input id="position" name="position" placeholder="Ej: Inspector / Administrativo" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate" className="font-bold text-foreground">Fecha de Ingreso</Label>
            <Input id="startDate" name="startDate" type="date" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category" className="font-bold text-foreground">Categoría</Label>
            <Input id="category" name="category" type="number" placeholder="Ej: 12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salary" className="font-bold text-foreground">Sueldo Mensual ($ ARS)</Label>
            <Input id="salary" name="salary" type="number" step="0.01" placeholder="Ej: 450000" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="schedule" className="font-bold text-foreground">Horario de Trabajo</Label>
            <Input id="schedule" name="schedule" placeholder="Ej: 08:00 a 14:00 hs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractType" className="font-bold text-foreground">Tipo de Contrato</Label>
            <select
              id="contractType"
              name="contractType"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              required
            >
              <option value="MENSUALIZADO">Mensualizado</option>
              <option value="PLANTA_PERMANENTE">Planta Permanente</option>
              <option value="MONOTRIBUTISTA">Monotributista / Contratado</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status" className="font-bold text-foreground">Estado Actual</Label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              required
            >
              <option value="ACTIVO">Activo</option>
              <option value="LICENCIA">Licencia Médica</option>
              <option value="VACACIONES">Vacaciones</option>
              <option value="BAJA">Baja / Inactivo</option>
            </select>
          </div>
          {status === "LICENCIA" && (
            <div className="space-y-2">
              <Label htmlFor="statusUntil" className="font-bold text-foreground">Licencia Hasta</Label>
              <Input id="statusUntil" name="statusUntil" type="date" />
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-primary">Legajo Digital y Observaciones</h4>
        <div className="space-y-2">
          <Label htmlFor="tasks" className="font-bold text-foreground">Títulos, Capacitaciones, Salud y Licencia de Conducir</Label>
          <Textarea
            id="tasks"
            name="tasks"
            placeholder="Ej: Título Secundario Completo. Aptitud Física Aprobada. Licencia de Conducir Clase B2."
            rows={4}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-bold text-base shadow-lg">
        {loading ? "Creando Legajo..." : "Crear Legajo de Agente"}
      </Button>
    </form>
  );
}
