"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createFuelRecordAction } from "../../actions/vehicle-actions";

export function FuelForm({ vehicles }: { vehicles: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await createFuelRecordAction(formData);
    if (res.success) {
      toast.success("Carga registrada con éxito");
      router.push("/admin/vehicles");
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vehicleId">Vehículo</Label>
        <select
          id="vehicleId"
          name="vehicleId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Seleccione vehículo</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticketNumber">N° de Ticket / Comprobante</Label>
          <Input id="ticketNumber" name="ticketNumber" placeholder="Ej: 0001-12345" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="liters">Litros Cargados</Label>
          <Input id="liters" name="liters" type="number" step="0.01" placeholder="0.00" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Importe Total ($)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
        </div>
      </div>

      <div className="flex gap-3 pt-4 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? "Registrando..." : "Guardar Rendición"}</Button>
      </div>
    </form>
  );
}
