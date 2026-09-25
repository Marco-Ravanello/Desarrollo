"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OCRScannerProps {
  onScanComplete: (data: any) => void;
}

export function OCRScanner({ onScanComplete }: OCRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const toastId = toast.loading("Analizando orden con IA Municipal...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "No se pudo extraer la información del documento.");
      }

      toast.success("Documento digitalizado con éxito", {
        id: toastId,
        description: `Se detectaron ${json.data.items?.length || 0} ítems y monto de $${json.data.amount || '0'}`
      });

      onScanComplete(json.data);
    } catch (error: any) {
      toast.error("Error al procesar el documento", {
        id: toastId,
        description: error.message
      });
    } finally {
      setIsScanning(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        id="ocr-upload"
        className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        disabled={isScanning}
      />
      <Button
        type="button"
        variant="outline"
        className="rounded-2xl border-primary/30 text-primary hover:bg-primary/5 text-xs font-bold gap-2"
        disabled={isScanning}
        asChild
      >
        <label htmlFor="ocr-upload" className="cursor-pointer">
          {isScanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Extrayendo Datos...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Escanear Orden (OCR IA)</span>
            </>
          )}
        </label>
      </Button>
    </div>
  );
}
