"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { uploadDocumentAction } from "../actions/upload-document";
import { Upload } from "lucide-react";

export function UploadDocumentForm({ personId, caseId }: { personId?: string, caseId?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (personId) formData.append("personId", personId);
    if (caseId) formData.append("caseId", caseId);

    const res = await uploadDocumentAction(formData);
    if (res.success) {
      toast.success("Documento subido correctamente");
    } else {
      toast.error(res.error);
    }
    setLoading(false);
    // Reset input
    e.target.value = "";
  }

  return (
    <div className="mt-4 p-4 border rounded-lg border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
      <Label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer gap-2 py-2">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full">
          <Upload className="h-5 w-5" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Subir Documentación</p>
          <p className="text-xs text-slate-500">Haz clic para seleccionar archivos (PDF, Imágenes)</p>
        </div>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
          accept="image/*,application/pdf"
        />
      </Label>
      {loading && <p className="text-center text-xs text-blue-600 animate-pulse mt-2">Subiendo...</p>}
    </div>
  );
}
