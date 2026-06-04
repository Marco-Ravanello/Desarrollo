"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { uploadDocumentAction } from "../actions/upload-document";
import { toast } from "sonner";

export function UploadDocumentForm({ personId, caseId }: { personId?: string, caseId?: string }) {
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;

    if (!fileInput.files?.[0]) {
      toast.error("Por favor seleccione un archivo");
      return;
    }

    setUploading(true);
    const formData = new FormData(form);

    try {
      const res = await uploadDocumentAction(formData);
      if (res.success) {
        toast.success("Documento subido correctamente");
        form.reset();
      } else {
        toast.error(res.error || "Fallo en la subida");
      }
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file" className="text-xs font-bold uppercase text-slate-500">Adjuntar Nuevo Documento</Label>
        <div className="flex gap-2">
          <Input id="file" name="file" type="file" required disabled={uploading} className="bg-background" />
          <input type="hidden" name="personId" value={personId || ""} />
          <input type="hidden" name="caseId" value={caseId || ""} />
          <Button type="submit" disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-2">{uploading ? "Subiendo..." : "Subir"}</span>
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-slate-400">Formatos permitidos: PDF, JPG, PNG. Máx 5MB.</p>
    </form>
  );
}
