"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createVehicleReservationAction } from "../../actions/vehicle-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Info } from "lucide-react";

export function ReserveVehicleForm({ vehicleId, vehicles }: { vehicleId: string, vehicles: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const res = await createVehicleReservationAction(formData);
    if (res.success) {
      toast.success("Solicitud enviada correctamente");
      router.push("/admin/vehicles");
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <Card className="max-w-xl mx-auto shadow-xl border-t-4 border-t-[#f5a623] rounded-3xl overflow-hidden">
      <CardHeader className="bg-slate-50/50">
        <CardTitle className="text-2xl text-[#004a80]">Solicitar Vehículo</CardTitle>
        <CardDescription>
          Complete los datos para que el área de Logística apruebe su solicitud.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="vehicleId" className="text-sm font-semibold">Seleccionar Unidad</Label>
            <Combobox
              name="vehicleId"
              defaultValue={vehicleId}
              placeholder="Patente, marca o modelo..."
              options={vehicles
                .filter(v => v.status === 'DISPONIBLE')
                .map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` }))
              }
              required
            />
            <p className="text-[10px] text-slate-400">Solo se muestran unidades disponibles y fuera de taller.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-semibold">Fecha y Hora de Inicio</Label>
              <Input
                id="startDate"
                name="startDate"
                type="datetime-local"
                required
                className="rounded-xl border-slate-200 focus:ring-[#f5a623] focus:border-[#f5a623]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-semibold">Fecha y Hora de Devolución</Label>
              <Input
                id="endDate"
                name="endDate"
                type="datetime-local"
                required
                className="rounded-xl border-slate-200 focus:ring-[#f5a623] focus:border-[#f5a623]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-semibold">Motivo del Uso y Destino</Label>
            <Input
              id="reason"
              name="reason"
              placeholder="Ej: Entrega de bolsones en B° San Martín"
              required
              className="rounded-xl border-slate-200"
            />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 items-start">
             <Info className="h-5 w-5 text-[#f5a623] shrink-0 mt-0.5" />
             <div className="text-xs text-amber-800 leading-relaxed">
               <strong>Nota Importante:</strong> El envío de este formulario no garantiza la reserva. Recibirá una notificación una vez que su solicitud sea revisada y aprobada por el administrador de flota.
             </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1 rounded-xl" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#004a80] hover:bg-[#00365d] text-white rounded-xl shadow-lg shadow-blue-900/20">
              {loading ? "Enviando Solicitud..." : "Enviar Solicitud"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
