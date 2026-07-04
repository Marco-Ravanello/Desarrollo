"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, ScanSearch } from "lucide-react";
import { createWorker } from "tesseract.js";
import { toast } from "sonner";

interface OCRScannerProps {
  onScanComplete: (data: {
    number?: string;
    amount?: string;
    cuit?: string;
    date?: string;
    expediente?: string;
    deliveryDate?: string;
    deliveryPlace?: string;
    paymentTerms?: string;
    description?: string;
    providerName?: string;
  }) => void;
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

      console.log("OCR Text Detected:", text);

      // Simple regex patterns for common fields
      let number = "";
      let amount = "";
      let cuit = "";
      let date = "";
      let expediente = "";
      let deliveryDate = "";
      let deliveryPlace = "";
      let paymentTerms = "";
      let description = "";
      let providerName = "";

      // Look for Orden de Compra N° - Handling common OCR errors and multi-line titles
      const orderMatch = text.match(/Orden\s*de\s*Compra\s*(?:N[°º]|Nro\.?|N)\s*(\d+)/i) ||
                         text.match(/N[°º]\s*(\d+)\s*\n\s*Unidad de Compra/i) ||
                         text.match(/(?:Orden de Compra|N[°º]|Número|O\/C|Ticket|Comprobante)\s*[:.]?\s*(\d+[-\d]*)/i);
      if (orderMatch) number = orderMatch[1];

      // Look for CUIT (format XX-XXXXXXXX-X or XXXXXXXXXXX)
      const cuitMatch = text.match(/(\d{2}-\d{8}-\d{1})/i) || text.match(/(\d{11})/i);
      if (cuitMatch) cuit = cuitMatch[1];

      // Look for Provider Name (usually after "Proveedor:" or similar)
      const providerMatch = text.match(/Proveedor\s*[:.-]?\s*(\d+)?\s*[-]?\s*([A-Z0-9\s]+)/i);
      if (providerMatch) {
          providerName = providerMatch[2].trim();
      }

      // Look for Date (format DD/MM/YYYY)
      const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
      if (dateMatch) date = dateMatch[0];

      // Look for Expediente (Improved for 312/2026 format from images)
      const expedienteMatch = text.match(/(?:Expediente|Suministro)\s*[:.]?\s*(?:Suministro\s+)?(?:Nro[:.]?\s*)?(\d+\/\d{4})/i) ||
                             text.match(/Nro\/Año[:.]?\s*(\d+\/\d{4})/i) ||
                             text.match(/Contratación tipo.*?(\d+\/\d{4})/i);
      if (expedienteMatch) expediente = expedienteMatch[1];

      // Look for Fecha de entrega
      const delivDateMatch = text.match(/(?:Fecha de entrega|Entrega):\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (delivDateMatch) deliveryDate = delivDateMatch[1];

      // Look for Lugar de entrega
      const delivPlaceMatch = text.match(/Sirvase entregar a:\s*([^\n]+)/i);
      if (delivPlaceMatch) {
        deliveryPlace = delivPlaceMatch[1].split(/(?:C\.U\.I\.T\.|Con domicilio|Localidad)/i)[0].trim();
      }

      // Look for Condicion de pago
      const paymentMatch = text.match(/Condición de pago:\s*([^\n]+)/i) ||
                         text.match(/Plazo de entrega:\s*([^\n]+)/i);
      if (paymentMatch) paymentTerms = paymentMatch[1].split(/Condición|Plazo/i)[0].trim();

      // Look for Contratación tipo (Description)
      const contratacionMatch = text.match(/Contratación tipo:\s*([^\n]+)/i);
      if (contratacionMatch) description = contratacionMatch[1].trim();

      // Look for Total (Argentine format: 6.950.000,00 or 6950000.00)
      // We look for "Total" or similar, then a value with potential dots as thousands separator and a comma for decimals
      const totalMatch = text.match(/(?:Total|Importe Total|Suma|Neto|TOTALES?|Importe|Pagado|S)\s*[:.]?\s*\$?\s*([\d\s.,]+)/i);

      if (totalMatch) {
          let val = totalMatch[1].trim().replace(/\s/g, '');
          // If it ends in ,XX or .XX it's likely decimal
          if (val.match(/[,.]\d{2}$/)) {
              const decimals = val.slice(-2);
              const whole = val.slice(0, -3).replace(/[.,]/g, '');
              amount = `${whole}.${decimals}`;
          } else {
              // Fallback: keep only digits and last two as decimals if many digits
              const digits = val.replace(/[^0-9]/g, '');
              if (digits.length > 2) {
                  amount = (parseFloat(digits) / 100).toFixed(2);
              } else {
                  amount = digits;
              }
          }
      }

      onScanComplete({
        number,
        amount,
        cuit,
        date,
        expediente,
        deliveryDate,
        deliveryPlace,
        paymentTerms,
        description,
        providerName
      });
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
