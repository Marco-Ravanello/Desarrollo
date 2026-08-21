"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateHRRecordAction } from "../actions/hr-actions";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { Car, GraduationCap } from "lucide-react";

export function EditHRForm({ agent, areas, onComplete }: { agent: any, areas: any[], onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(agent.status || "ACTIVO");
  const [contractType, setContractType] = useState(agent.contractType || "MENSUALIZADO");

  let legajoData = { tasksText: agent.tasks || "", healthNotes: "", education: "", drivingLicense: "" };
  try {
    if (agent.tasks?.startsWith("{")) {
      const parsed = JSON.parse(agent.tasks);
      legajoData = {
        tasksText: parsed.tasksText || "",
        healthNotes: parsed.healthNotes || "",
        education: parsed.education || "",
        drivingLicense: parsed.drivingLicense || ""
      };
    }
  } catch (e) {}

  const [hasDrivingPermit, setHasDrivingPermit] = useState(Boolean(legajoData.drivingLicense));
  const [hasAcademicStatus, setHasAcademicStatus] = useState(Boolean(legajoData.education));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateHRRecordAction(agent.id, formData);

    if (res.success) {
      toast.success("Legajo actualizado correctamente");
      onComplete();
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
            <Input id="firstName" name="firstName" defaultValue={agent.firstName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="font-bold text-foreground">Apellido</Label>
            <Input id="lastName" name="lastName" defaultValue={agent.lastName} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dni" className="font-bold text-foreground">DNI</Label>
            <Input id="dni" name="dni" defaultValue={agent.dni} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileNumber" className="font-bold text-foreground">N° Legajo / CUIT</Label>
            <Input id="fileNumber" name="fileNumber" defaultValue={agent.fileNumber || ""} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl" className="font-bold text-foreground">URL Foto de Perfil (Opcional)</Label>
          <Input id="imageUrl" name="imageUrl" defaultValue={agent.imageUrl || ""} placeholder="https://..." />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-primary">Situación Revista y Salarial</h4>

        <div className="space-y-2">
          <Label className="font-bold text-foreground">Área de Pertenencia</Label>
          <Combobox
            name="areaId"
            defaultValue={agent.area?.id}
            options={areas.map(a => ({ value: a.id, label: a.name }))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="position" className="font-bold text-foreground">Cargo / Función</Label>
            <Input id="position" name="position" defaultValue={agent.position} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate" className="font-bold text-foreground">Fecha de Ingreso</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={agent.startDate ? agent.startDate.split('T')[0] : ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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

          {contractType !== "MONOTRIBUTISTA" ? (
            <div className="space-y-2 animate-in fade-in duration-200">
              <Label htmlFor="category" className="font-bold text-foreground">Categoría</Label>
              <Input id="category" name="category" type="number" defaultValue={agent.category || ""} placeholder="Ej: 12" />
            </div>
          ) : (
            <div className="space-y-2 opacity-50">
              <Label className="font-bold text-muted-foreground">Categoría</Label>
              <Input placeholder="No aplica a Monotributistas" disabled className="bg-muted/40 cursor-not-allowed" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="salary" className="font-bold text-foreground">Sueldo / Haber Mensual ($ ARS)</Label>
            <Input id="salary" name="salary" type="number" step="0.01" defaultValue={agent.salary || ""} placeholder="Ej: 450000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule" className="font-bold text-foreground">Horario de Trabajo</Label>
            <Input id="schedule" name="schedule" defaultValue={agent.schedule || ""} placeholder="Ej: 08:00 a 14:00 hs" />
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
              <Input id="statusUntil" name="statusUntil" type="date" defaultValue={agent.statusUntil ? agent.statusUntil.split('T')[0] : ""} />
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-primary">Legajo Digital Unificado</h4>
        <div className="space-y-2">
          <Label htmlFor="tasks" className="font-bold text-foreground">📋 Funciones y Tareas del Puesto</Label>
          <Textarea id="tasks" name="tasks" defaultValue={legajoData.tasksText} rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="healthNotes" className="font-bold text-foreground">🩺 Salud, Carpetas Médicas y Aptitud Física</Label>
          <Textarea id="healthNotes" name="healthNotes" defaultValue={legajoData.healthNotes} rows={2} />
        </div>

        <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border/50">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasAcademicStatus" className="font-bold text-foreground cursor-pointer flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-purple-400" /> ¿Posee título o es alumno regular?
            </Label>
            <input
              type="checkbox"
              id="hasAcademicStatus"
              checked={hasAcademicStatus}
              onChange={(e) => setHasAcademicStatus(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
            />
          </div>
          {hasAcademicStatus && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <Label htmlFor="education" className="text-xs font-bold text-muted-foreground">Detalle de Título, Carrera o Alumno Regular</Label>
              <Textarea
                id="education"
                name="education"
                defaultValue={legajoData.education}
                placeholder="Ej: Alumno Regular de Trabajo Social (3er año) / Título Secundario Completo."
                rows={2}
              />
            </div>
          )}
        </div>

        <div className="space-y-3 p-3.5 rounded-2xl bg-muted/20 border border-border/50">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasDrivingPermit" className="font-bold text-foreground cursor-pointer flex items-center gap-2">
              <Car className="h-4 w-4 text-teal-400" /> ¿Habilitado para conducir flota municipal?
            </Label>
            <input
              type="checkbox"
              id="hasDrivingPermit"
              checked={hasDrivingPermit}
              onChange={(e) => setHasDrivingPermit(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
            />
          </div>
          {hasDrivingPermit && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <Label htmlFor="drivingLicense" className="text-xs font-bold text-muted-foreground">Detalle de Licencia y Habilitación</Label>
              <Input id="drivingLicense" name="drivingLicense" defaultValue={legajoData.drivingLicense} placeholder="Ej: Licencia Profesional Clase B2 / C" />
            </div>
          )}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-bold text-base shadow-lg">
        {loading ? "Guardando Cambios..." : "Guardar Cambios del Legajo"}
      </Button>
    </form>
  );
}
