"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createCaseAction } from "../actions/create-case";
import { Plus } from "lucide-react";

export function CreateCaseForm({ personId, areas }: { personId: string, areas: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await createCaseAction(formData);
    if (res.success) {
      toast.success("Caso creado exitosamente");
      setOpen(false);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="w-full mt-4">
        <Plus className="h-4 w-4 mr-2" /> Nuevo Caso
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-4 animate-in slide-in-from-top-2">
      <input type="hidden" name="personId" value={personId} />

      <div className="space-y-2">
        <Label htmlFor="title">Título del Caso</Label>
        <Input id="title" name="title" placeholder="Ej: Solicitud de materiales" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="areaId">Área Responsable</Label>
        <select
          id="areaId"
          name="areaId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Seleccione un área</option>
          {areas.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          name="description"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Detalles del problema o solicitud..."
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? "Creando..." : "Guardar Caso"}</Button>
      </div>
    </form>
  );
}
