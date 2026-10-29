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

export function CreateAgreementForm({ areas, defaultAreaId = "" }: { areas: { id: string; name: string }[]; defaultAreaId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    number: "",
    parties: "",
    amount: "",
    startDate: "",
    endDate: "",
    description: "",
    areaId: defaultAreaId,
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
    setError(null);
    const fd = new FormData(e.currentTarget);

    try {
      const result = await createAgreementAction(fd);
      if (result.success) {
        toast.success("Convenio guardado.");
        router.push(`/admin/agreements/${result.id}`);
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("No se pudo guardar el convenio. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Nuevo convenio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
           <h4 className="text-xs font-bold text-muted-foreground mb-3">Carga desde un documento</h4>
           <OCRScanner onScanComplete={handleScanComplete} label="Escanear el convenio" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="text-xs text-muted-foreground">Los campos con <span className="font-bold text-rose-600">*</span> son obligatorios.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="title">Título u objeto del convenio <Required /></Label>
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
              <Label htmlFor="number">Número de convenio o registro (opcional)</Label>
              <Input
                id="number"
                name="number"
                aria-describedby="number-hint"
                placeholder="Ej: CONV-2026-045"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: e.target.value})}
              />
              <p id="number-hint" className="text-xs text-muted-foreground">Si todavía no tiene número, dejalo vacío y cargalo después.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parties">Partes: con quién se firma <Required /></Label>
              <Input
                id="parties"
                name="parties"
                required
                placeholder="Ej: Municipalidad y Asociación Civil"
                value={formData.parties}
                onChange={(e) => setFormData({...formData, parties: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto en pesos (opcional)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaId">Área responsable (opcional)</Label>
              <select
                id="areaId"
                name="areaId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.areaId}
                onChange={(e) => setFormData({...formData, areaId: e.target.value})}
              >
                <option value="">Sin área</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de inicio (opcional)</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de vencimiento (opcional)</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                min={formData.startDate || undefined}
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              />
            </div>
            <fieldset className="md:col-span-2 space-y-2">
              <legend className="text-sm font-medium">Estado</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "VIGENTE", label: "Vigente", hint: "Ya está firmado." },
                  { value: "EN_REVISION", label: "En revisión", hint: "Todavía se está armando o falta la firma." },
                ].map((o) => (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm ${
                      formData.status === o.value ? "border-primary bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={o.value}
                      checked={formData.status === o.value}
                      onChange={() => setFormData({ ...formData, status: o.value })}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span>
                      <span className="block font-semibold text-foreground">{o.label}</span>
                      <span className="block text-xs text-muted-foreground">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Detalles (opcional)</Label>
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

          {error && (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-800 dark:text-rose-200">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Guardar convenio"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Required() {
  return (
    <span className="text-rose-600" aria-hidden>
      *
    </span>
  );
}
