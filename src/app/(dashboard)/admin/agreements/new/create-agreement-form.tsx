"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createAgreementAction } from "../../actions/agreement-actions";
import dynamic from "next/dynamic";

const OCRScanner = dynamic(() => import("@/components/ocr/ocr-scanner").then(mod => mod.OCRScanner), {
  ssr: false,
});

export function CreateAgreementForm({ areas }: { areas: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    number: "",
    parties: "",
    amount: "",
    startDate: "",
    endDate: "",
    description: "",
    areaId: "",
    status: "VIGENTE"
  });

  const handleScanComplete = (data: any) => {
    setFormData(prev => ({
      ...prev,
      title: data.description || prev.title, // OCR description mapped to title
      number: data.number || prev.number,
      amount: data.amount || prev.amount,
      startDate: data.date ? data.date.split('/').reverse().join('-') : prev.startDate,
      description: data.description || prev.description
    }));

    if (data.number || data.amount || data.description) {
      toast.success("Campos detectados y completados");
    } else {
      toast.warning("No se detectaron campos conocidos en la imagen");
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      const result = await createAgreementAction(fd);
      if (result.success) {
        toast.success("Convenio registrado exitosamente");
        router.push("/admin/agreements");
      } else {
        toast.error(result.error || "Error al registrar convenio");
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Nuevo Convenio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
           <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Asistente de Carga (OCR)</h4>
           <OCRScanner onScanComplete={handleScanComplete} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="title">Título / Objeto del Convenio</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ej: Convenio de Cooperación con Ministerio de Desarrollo"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Número de Convenio / Registro</Label>
              <Input
                id="number"
                name="number"
                placeholder="Ej: CONV-2026-045"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parties">Partes Intervinientes</Label>
              <Input
                id="parties"
                name="parties"
                placeholder="Ej: Municipalidad y Asociación Civil"
                value={formData.parties}
                onChange={(e) => setFormData({...formData, parties: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto (Si aplica)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaId">Área Responsable</Label>
              <select
                id="areaId"
                name="areaId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.areaId}
                onChange={(e) => setFormData({...formData, areaId: e.target.value})}
              >
                <option value="">Seleccionar área...</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de Vencimiento</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Detalles Adicionales</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Observaciones..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? "Registrando..." : "Guardar Convenio"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
