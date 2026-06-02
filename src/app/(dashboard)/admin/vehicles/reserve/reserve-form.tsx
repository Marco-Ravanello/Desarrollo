"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createVehicleReservationAction } from "../../actions/vehicle-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";

export function ReserveVehicleForm({ vehicleId, vehicles }: { vehicleId: string, vehicles: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await createVehicleReservationAction(formData);
    if (res.success) {
      toast.success("Reserva confirmada");
      router.push("/admin/vehicles");
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Detalles de la Reserva</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicleId">Vehículo</Label>
            <Combobox
              name="vehicleId"
              defaultValue={vehicleId}
              placeholder="Buscar vehículo..."
              options={vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Inicio</Label>
              <Input id="startDate" name="startDate" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fin</Label>
              <Input id="endDate" name="endDate" type="datetime-local" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo del uso</Label>
            <Input id="reason" name="reason" placeholder="Ej: Traslado de mercadería" required />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Confirmando..." : "Confirmar Reserva"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
