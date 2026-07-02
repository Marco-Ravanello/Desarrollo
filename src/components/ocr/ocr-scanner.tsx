"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ScanSearch } from "lucide-react";
import { createWorker } from "tesseract.js";
import { toast } from "sonner";

interface OCRScannerProps {
  onScanComplete: (data: { number?: string; amount?: string; cuit?: string; date?: string }) => void;
}

export function OCRScanner({ onScanComplete }: OCRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const toastId = toast.loading("Analizando imagen...");

    try {
      const worker = await createWorker("spa");
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      // Simple regex patterns for common fields
      const lines = text.split("\n");
      let number = "";
      let amount = "";
      let cuit = "";
      let date = "";

      // Look for Orden de Compra N°
      const orderMatch = text.match(/(?:Orden de Compra|N°|Número|O\/C)\s*[:.]?\s*(\d+)/i);
      if (orderMatch) number = orderMatch[1];

      // Look for CUIT (format XX-XXXXXXXX-X or XXXXXXXXXXX)
      const cuitMatch = text.match(/(\d{2}-\d{8}-\d{1})|(\d{11})/);
      if (cuitMatch) cuit = cuitMatch[0].replace(/-/g, '');

      // Look for Date (format DD/MM/YYYY)
      const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
      if (dateMatch) date = dateMatch[0];

      // Look for Total (simplified) - prioritize lines near the bottom or containing '$'
      const totalMatch = text.match(/(?:Total|Importe|Suma|Neto)\s*[:.]?\s*\$?\s*([\d.]+,\d{2})/i) ||
                         text.match(/(?:Total|Importe|Suma|Neto)\s*[:.]?\s*\$?\s*([\d,.]+)/i);

      if (totalMatch) {
          // Clean amount string:
          // If it ends in ,XX it's likely AR format (dots for thousands, comma for decimals)
          let val = totalMatch[1];
          if (val.includes(',') && val.split(',')[1].length === 2) {
              amount = val.replace(/\./g, '').replace(',', '.');
          } else {
              amount = val.replace(/,/g, '');
          }
      }

      onScanComplete({ number, amount, cuit, date });
      toast.success("Análisis completado", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar la imagen", { id: toastId });
    } finally {
      setIsScanning(false);
      e.target.value = "";
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={isScanning}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <Button
        type="button"
        variant="outline"
        disabled={isScanning}
        className="w-full border-dashed border-2 h-20 flex flex-col gap-2 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-all"
      >
        {isScanning ? (
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        ) : (
          <Camera className="h-6 w-6 text-blue-600" />
        )}
        <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">
          {isScanning ? "Procesando..." : "Escanear Documento / Foto"}
        </span>
      </Button>
    </div>
  );
}
