"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createVehicleAction } from "../../actions/create-vehicle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateVehicleForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await createVehicleAction(formData);
    if (res.success) {
      toast.success("Vehículo registrado");
      router.push("/admin/vehicles");
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Datos del Vehículo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plate">Patente / Dominio</Label>
            <Input id="plate" name="plate" placeholder="Ej: AA123BB" required className="uppercase" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Marca</Label>
            <Input id="brand" name="brand" placeholder="Ej: Toyota" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo</Label>
            <Input id="model" name="model" placeholder="Ej: Hilux" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuelCardNumber">Número de Tarjeta YPF en Ruta</Label>
            <Input id="fuelCardNumber" name="fuelCardNumber" placeholder="Opcional" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuelMonthlyLimit">Cupo Mensual ($)</Label>
            <Input id="fuelMonthlyLimit" name="fuelMonthlyLimit" type="number" placeholder="0.00" defaultValue="0" />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Registrando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
