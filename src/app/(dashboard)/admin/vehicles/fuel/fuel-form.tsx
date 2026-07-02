"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createFuelRecordAction } from "../../actions/vehicle-actions";
import { Combobox } from "@/components/ui/combobox";
import { OCRScanner } from "@/components/ocr/ocr-scanner";

export function FuelForm({ vehicles }: { vehicles: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fuelData, setFuelData] = useState({
    amount: "",
    ticketNumber: "",
    date: new Date().toISOString().split('T')[0]
  });

  const handleScanComplete = (data: any) => {
    setFuelData({
      amount: data.amount || "",
      ticketNumber: data.number || "",
      date: data.date ? data.date.split('/').reverse().join('-') : fuelData.date
    });
    toast.info("Campos completados desde el ticket");
  };

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
    <div className="space-y-8">
      <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30">
           <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3">Asistente de Carga Rápida (Foto Ticket)</h4>
           <OCRScanner onScanComplete={handleScanComplete} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="vehicleId" className="font-semibold">Vehículo</Label>
        <Combobox
          name="vehicleId"
          placeholder="Buscar vehículo por patente..."
          options={vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` }))}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="date" className="font-semibold">Fecha de Carga</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            value={fuelData.date}
            onChange={(e) => setFuelData({...fuelData, date: e.target.value})}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticketNumber" className="font-semibold">N° de Ticket / Operación</Label>
          <Input
            id="ticketNumber"
            name="ticketNumber"
            placeholder="Ej: 0001-12345"
            required
            value={fuelData.ticketNumber}
            onChange={(e) => setFuelData({...fuelData, ticketNumber: e.target.value})}
            className="rounded-xl font-mono uppercase"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="liters" className="font-semibold">Litros Cargados</Label>
          <div className="relative">
            <Input id="liters" name="liters" type="number" step="0.01" placeholder="0.00" required className="rounded-xl pr-10" />
            <span className="absolute right-3 top-2.5 text-slate-400 text-sm font-bold">Lts</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount" className="font-semibold">Importe Total</Label>
          <div className="relative">
             <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">$</span>
             <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
                value={fuelData.amount}
                onChange={(e) => setFuelData({...fuelData, amount: e.target.value})}
                className="rounded-xl pl-8"
             />
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="button" variant="ghost" className="flex-1 rounded-xl" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="flex-1 bg-[#004a80] hover:bg-[#00365d] text-white rounded-xl shadow-lg shadow-blue-900/20">
          {loading ? "Registrando..." : "Guardar Carga"}
        </Button>
      </div>
    </form>
    </div>
  );
}
