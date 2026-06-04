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
    <Card>
      <CardHeader><CardTitle>Nuevo Legajo</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" name="lastName" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dni">DNI</Label>
              <Input id="dni" name="dni" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileNumber">N° de Legajo</Label>
              <Input id="fileNumber" name="fileNumber" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Área de Pertenencia</Label>
            <Combobox
              name="areaId"
              placeholder="Seleccionar área..."
              options={(areas || []).map(a => ({ value: a.id, label: a.name }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Cargo / Función</Label>
            <Input id="position" name="position" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha de Ingreso</Label>
            <Input id="startDate" name="startDate" type="date" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Guardando..." : "Guardar Legajo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
