"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
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
    patente?: string;
    liters?: string;
  }) => void;
}

export function OCRScanner({ onScanComplete }: OCRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  const preprocessImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          // Scale up if image is small to improve OCR
          let width = img.width;
          let height = img.height;
          if (width < 1500) {
            const scale = 1500 / width;
            width = 1500;
            height = img.height * scale;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Grayscale and contrast enhancement
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            // Increase contrast
            const contrast = 1.3;
            let newValue = (avg - 128) * contrast + 128;
            newValue = Math.max(0, Math.min(255, newValue));

            data[i] = newValue;
            data[i + 1] = newValue;
            data[i + 2] = newValue;
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const toastId = toast.loading("Analizando imagen con alta precisión...");

    try {
      const processedImage = await preprocessImage(file);
      // Use both Spanish and English for better recognition of symbols/numbers
      const worker = await createWorker(["spa", "eng"]);
      const { data: { text } } = await worker.recognize(processedImage);
      await worker.terminate();

      console.log("OCR Text Detected:", text);

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
      let patente = "";
      let liters = "";

      // 1. Order Number / Ticket Number
      const orderMatch = text.match(/Orden\s*de\s*Compra\s*(?:N[°º]|Nro\.?|N)?\s*(\d+)/i) ||
                         text.match(/N[°º]\s*(\d+)\s*\n\s*Unidad de Compra/i) ||
                         text.match(/(?:Remito|Ticket|Operaci[óo]n|Nro|N[°º])\s*[:.-]?\s*(\d{4}-\d{8}|\d+[-\d]*)/i);
      if (orderMatch) number = orderMatch[1];

      // 2. CUIT (Argentina format)
      const cuitMatch = text.match(/(\d{2}-\d{8}-\d{1})/) || text.match(/(\d{11})/);
      if (cuitMatch) cuit = cuitMatch[1];

      // 3. Provider Name
      const providerMatch = text.match(/Proveedor\s*[:.-]?\s*(\d+)?\s*[-]?\s*([A-Z0-9\s.]{3,})/i);
      if (providerMatch && providerMatch[2]) {
          providerName = providerMatch[2].trim().split('\n')[0].trim();
      }

      // 4. Dates
      const dateMatches = text.match(/\d{2}\/\d{2}\/\d{4}/g);
      if (dateMatches) {
          date = dateMatches[0];
          // If there's a second date, it might be delivery date
          if (dateMatches.length > 1) deliveryDate = dateMatches[1];
      }

      // 5. Expediente
      const expedienteMatch = text.match(/(?:Expediente|Suministro|Nro\/A[ñn]o)\s*[:.-]?\s*(\d+\/\d{4})/i);
      if (expedienteMatch) expediente = expedienteMatch[1];

      // 6. Delivery specific fields
      const delivDateMatch = text.match(/(?:Fecha de entrega|Plazo de entrega|Entrega)[:.-]?\s*(\d{2}\/\d{2}\/\d{4}|[^\n]+)/i);
      if (delivDateMatch && !deliveryDate) deliveryDate = delivDateMatch[1].trim();

      const delivPlaceMatch = text.match(/(?:S[íi]rvase entregar a|Lugar de entrega)[:.-]?\s*([^\n]+)/i);
      if (delivPlaceMatch) {
        deliveryPlace = delivPlaceMatch[1].split(/(?:C\.U\.I\.T\.|Con domicilio|Localidad|C\.P\.)/i)[0].trim();
      }

      // 7. Payment Terms
      const paymentMatch = text.match(/Condici[óo]n de pago[:.-]?\s*([^\n]+)/i);
      if (paymentMatch) paymentTerms = paymentMatch[1].trim();

      // 8. Vehicle Plate (Patente Argentina)
      const patenteMatch = text.match(/Patente[:.-]?\s*([A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]{3}\s?\d{3})/i);
      if (patenteMatch) patente = patenteMatch[1].replace(/\s/g, '').toUpperCase();

      // 9. Liters
      const litersMatch = text.match(/(?:Litros|Cant|Cantidad|Volumen|CAN[TI])[:.-]?\s*([\d.,]+)/i) ||
                          text.match(/([\d.,]+)\s*(?:Lts|Litros|L|LTS)/i);
      if (litersMatch) {
          liters = litersMatch[1].replace(',', '.');
      }

      // 10. Amounts (Improved)
      // Look for Total followed by a number, handling Argentine format (dot for thousands, comma for decimals)
      const totalMatch = text.match(/(?:Total|Importe|Suma|Monto|Pagar|Venta)[:.-]?\s*\$?\s*([\d\s.,]{3,})/i) ||
                         text.match(/TOTAL[:\s]*\$?\s*([\d\s.,]{3,})/i);
      if (totalMatch) {
          let rawVal = totalMatch[1].trim().split('\n')[0].trim();
          // If it has multiple dots and one comma at the end: 6.950.000,00
          if (rawVal.includes('.') && rawVal.includes(',')) {
              amount = rawVal.replace(/\./g, '').replace(',', '.');
          }
          // If it has only comma: 1234,56
          else if (rawVal.includes(',') && !rawVal.includes('.')) {
              amount = rawVal.replace(',', '.');
          }
          // If it has only one dot and it's 2 digits from end: 1234.56
          else if (rawVal.match(/\.\d{2}$/)) {
              amount = rawVal;
          }
          // Otherwise, assume dots are thousands and remove them
          else {
              amount = rawVal.replace(/[.\s]/g, '');
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
        providerName,
        patente,
        liters
      });
      toast.success("Análisis completado", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar la imagen", { id: toastId });
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = "";
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
