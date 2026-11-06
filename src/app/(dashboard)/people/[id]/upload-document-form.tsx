"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { uploadDocumentAction } from "../actions/upload-document";
import { toast } from "sonner";
import { DOCUMENT_KINDS } from "@/lib/document-kinds";

export function UploadDocumentForm({ personId, caseId }: { personId?: string, caseId?: string }) {
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File | null;
    const hasFile = Boolean(file && file.size > 0);
    const kind = String(formData.get("kind") || "OTRO");
    const expires = String(formData.get("expiresAt") || "");

    if (!hasFile && !(kind !== "OTRO" && expires)) {
      toast.error("Elegí un archivo, o el tipo de documento y cuándo vence.");
      return;
    }

    setUploading(true);
    try {
      const res = await uploadDocumentAction(formData);
      if (res.success) {
        toast.success(hasFile ? "Documento subido." : "Vencimiento anotado.");
        form.reset();
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo subir el documento.");
      }
    } catch {
      toast.error("No se pudo subir el documento. Revisá la conexión y probá de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
      <p className="text-sm font-bold text-foreground">Agregar un documento</p>
      <input type="hidden" name="personId" value={personId || ""} />
      <input type="hidden" name="caseId" value={caseId || ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-kind" className="text-xs font-bold text-muted-foreground">Tipo de documento</Label>
          <select id="doc-kind" name="kind" defaultValue="OTRO" disabled={uploading} className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground">
            {DOCUMENT_KINDS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-expires" className="text-xs font-bold text-muted-foreground">Vence el (opcional)</Label>
          <Input id="doc-expires" name="expiresAt" type="date" disabled={uploading} className="h-10 rounded-xl border-border/60 bg-background text-foreground" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file" className="text-xs font-bold text-muted-foreground">Archivo</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="file" name="file" type="file" disabled={uploading} className="border-border/60 bg-background text-xs text-foreground" />
          <Button type="submit" disabled={uploading} className="shrink-0 bg-primary text-xs font-bold text-primary-foreground">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-2">{uploading ? "Guardando…" : "Guardar"}</span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        PDF, JPG o PNG, hasta 5 MB. Si no tenés el archivo a mano, elegí el tipo y la fecha y queda anotado solo el vencimiento. La app avisa un mes antes de que venza.
      </p>
    </form>
  );
}
