"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createVehicleAction } from "../../actions/create-vehicle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <Card className="max-w-2xl mx-auto shadow-xl border-t-4 border-t-[#004a80] rounded-3xl">
      <CardHeader>
        <CardTitle className="text-2xl text-[#004a80]">Registrar Nueva Unidad</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#f5a623] rounded-full" />
                Información Básica
              </h3>
              <div className="space-y-2">
                <Label htmlFor="plate">Patente / Dominio</Label>
                <Input id="plate" name="plate" placeholder="Ej: AA123BB" required className="uppercase font-mono text-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" name="brand" placeholder="Ej: Toyota" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input id="model" name="model" placeholder="Ej: Hilux" required />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#f5a623] rounded-full" />
                Control y Combustible
              </h3>
              <div className="space-y-2">
                <Label htmlFor="fuelCardNumber">Tarjeta YPF en Ruta</Label>
                <Input id="fuelCardNumber" name="fuelCardNumber" placeholder="Número de tarjeta" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuelMonthlyLimit">Cupo Mensual ($)</Label>
                <Input id="fuelMonthlyLimit" name="fuelMonthlyLimit" type="number" placeholder="0.00" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastServiceKm">Kilometraje Último Service</Label>
                <Input id="lastServiceKm" name="lastServiceKm" type="number" placeholder="0" defaultValue="0" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#f5a623] rounded-full" />
              Vencimientos de Documentación
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="vtvExpiry">Vencimiento VTV</Label>
                <Input id="vtvExpiry" name="vtvExpiry" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceExpiry">Vencimiento Seguro</Label>
                <Input id="insuranceExpiry" name="insuranceExpiry" type="date" />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="ghost" className="flex-1 rounded-xl" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#004a80] hover:bg-[#00365d] text-white rounded-xl">
              {loading ? "Registrando..." : "Guardar Vehículo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
