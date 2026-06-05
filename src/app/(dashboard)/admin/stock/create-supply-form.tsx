"use client";

import { useState } from "react";
import { addSupplyAction } from "@/app/(dashboard)/admin/actions/stock-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function CreateSupplyForm({ areas }: { areas: any[] }) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      await addSupplyAction(formData);
      toast.success("Insumo registrado correctamente");
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast.error("Error al registrar insumo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nuevo Insumo</CardTitle>
        <CardDescription>Agregar un nuevo artículo al inventario.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Insumo</Label>
            <Input id="name" name="name" placeholder="Ej: Resmas A4" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input id="description" name="description" placeholder="Opcional..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Inicial</Label>
              <Input id="stock" name="stock" type="number" defaultValue="0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Stock Mínimo</Label>
              <Input id="minStock" name="minStock" type="number" defaultValue="5" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="areaId">Área Responsable</Label>
            <select
              id="areaId"
              name="areaId"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Depósito General</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Registrando..." : <><Plus className="h-4 w-4 mr-2"/> Registrar Insumo</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
