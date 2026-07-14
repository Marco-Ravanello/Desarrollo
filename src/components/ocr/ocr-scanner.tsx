"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Camera } from "lucide-react";
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
    items?: Array<{
      quantity: string;
      unitOfMeasure: string;
      description: string;
      unitPrice: string;
      totalPrice: string;
    }>;
  }) => void;
}

export function OCRScanner({ onScanComplete }: OCRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  const preprocessImage = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas.toDataURL("image/jpeg", 0.9);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const contrast = 1.3;
      let newValue = (avg - 128) * contrast + 128;
      newValue = Math.max(0, Math.min(255, newValue));
      data[i] = newValue; data[i + 1] = newValue; data[i + 2] = newValue;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const processPDF = async (file: File): Promise<string> => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items as any[];

      const linesMap: { [key: number]: any[] } = {};
      const threshold = 3; // Tightened threshold

      textItems.forEach(item => {
        const y = Math.round(item.transform[5]);
        const existingY = Object.keys(linesMap).find(ly => Math.abs(Number(ly) - y) <= threshold);
        const groupY = existingY ? Number(existingY) : y;
        if (!linesMap[groupY]) linesMap[groupY] = [];
        linesMap[groupY].push(item);
      });

      const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
      fullText += sortedY.map(y => {
        return linesMap[y]
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map(item => item.str)
          .join("  "); // Use double space to separate items on same line
      }).join("\n") + "\n";
    }
    return fullText;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    const toastId = toast.loading("Analizando documento...");
    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await processPDF(file);
      } else {
        const reader = new FileReader();
        const imgPromise = new Promise<string>((resolve) => {
          reader.onload = (re) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              if (!ctx) { resolve(re.target?.result as string); return; }
              let w = img.width, h = img.height;
              if (w < 1500) { h = h * (1500 / w); w = 1500; }
              canvas.width = w; canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              resolve(preprocessImage(canvas));
            };
            img.src = re.target?.result as string;
          };
          reader.readAsDataURL(file);
        });
        const processedImage = await imgPromise;
        const worker = await createWorker(["spa", "eng"]);
        const { data: { text: ocrText } } = await worker.recognize(processedImage);
        text = ocrText;
        await worker.terminate();
      }

      console.log("Extracted Text:", text);

      const sanitizePrice = (val: string) => {
        if (!val) return "0";
        // Remove dots (thousands) and replace comma with dot (decimal)
        let sanitized = val.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(sanitized);
        return isNaN(num) ? "0" : num.toString();
      };

      // 1. Order Number - Matches "N° 253"
      const number = (text.match(/N[°º]\s*(\d+)/i)?.[1]) || "";

      // 2. Order Total
      let amount = "";
      const totalMatch = text.match(/Total\s*[:$]\s*\$?\s*([\d.\s,]{3,})/i) ||
                         text.match(/Importe\s+total\s*[:$]?\s*\$?\s*([\d.\s,]{3,})/i) ||
                         text.match(/TOTAL[:\s]*\$?\s*([\d.\s,]{3,})/i);
      if (totalMatch) amount = sanitizePrice(totalMatch[1].trim());

      // 3. Metadata
      const cuit = (text.match(/C\.?U\.?I\.?T\.?[\s\S]*?(\d{2}-\d{8}-\d{1}|\d{11})/i)?.[1]) || "";
      const providerMatch = text.match(/Proveedor\s*[:.-]?\s*(\d+)?\s*[-]?\s*([A-Z0-9\s.]{3,})/i);
      const providerName = providerMatch?.[2]?.split('\n')[0].trim() || "";

      const expediente = (text.match(/(?:Expediente|Suministro)[\s\S]*?(\d+\/\d{4})/i)?.[1]) || "";

      const dateMatches = text.match(/\d{2}\/\d{2}\/\d{4}/g);
      const date = dateMatches?.[0] || "";
      const deliveryDate = (dateMatches && dateMatches.length > 1) ? dateMatches[dateMatches.length - 1] : "";

      // Improved Place and Payment - handle "label below value"
      const linesForSearch = text.split('\n').map(l => l.trim());

      let deliveryPlace = "";
      const delivIndex = linesForSearch.findIndex(l => l.toLowerCase().includes("sirvase entregar a"));
      if (delivIndex > 0) {
          deliveryPlace = linesForSearch[delivIndex - 1];
      }

      let paymentTerms = "";
      const payIndex = linesForSearch.findIndex(l => l.toLowerCase().includes("condición de pago") || l.toLowerCase().includes("condicion de pago"));
      if (payIndex > 0) {
          paymentTerms = linesForSearch[payIndex - 1];
      }

      // 4. Items Extraction (Tres de Febrero PDF format)
      const items: any[] = [];
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let itemsStarted = false;
      let currentItem: any = null;

      for (const line of lines) {
        if (line.match(/Reng\.?/i) && line.match(/Cant/i) && line.match(/Descrip/i)) {
            itemsStarted = true;
            continue;
        }
        if (itemsStarted) {
          if (line.match(/Total\s*[:$]/i) || line.match(/Cl[áa]usulas/i) || line.match(/Autorizado/i)) {
            if (currentItem) items.push(currentItem);
            itemsStarted = false;
            break;
          }

          // Format: [Renglon] [Codigo] [Quantity] [U.Medida] [CatProg] [Description] $ [UnitPrice] $ [TotalPrice]
          const rowMatch = line.match(/^(\d+)\s+([\d.]+)\s+([\d.,]+)\s+([A-Z\s]{3,})\s+([\d.]+)\s+(.*?)\$\s*([\d.\s,]+)\s*\$\s*([\d.\s,]+)/);

          if (rowMatch) {
            if (currentItem) items.push(currentItem);
            currentItem = {
              quantity: sanitizePrice(rowMatch[3]),
              unitOfMeasure: rowMatch[4].trim(),
              description: rowMatch[6].trim(),
              unitPrice: sanitizePrice(rowMatch[7]),
              totalPrice: sanitizePrice(rowMatch[8])
            };
          } else if (currentItem && line.length > 5) {
             currentItem.description += " " + line;
          }
        }
      }

      onScanComplete({ number, amount, cuit, date, expediente, deliveryDate, deliveryPlace, paymentTerms, description: "", providerName, items });
      toast.success("Análisis completado", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar el documento", { id: toastId });
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="relative">
      <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} disabled={isScanning} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      <Button type="button" variant="outline" disabled={isScanning} className="w-full border-dashed border-2 h-24 flex flex-col gap-2 rounded-2xl hover:bg-blue-50 transition-all">
        {isScanning ? <Loader2 className="h-7 w-7 animate-spin text-blue-600" /> : <div className="flex gap-4"><Camera className="h-7 w-7 text-blue-500" /><FileText className="h-7 w-7 text-blue-700" /></div>}
        <div className="flex flex-col text-center">
            <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{isScanning ? "Procesando documento..." : "Subir PDF o Foto de Orden"}</span>
            <span className="text-[10px] text-slate-500 font-medium">Soporta órdenes digitales y escaneos de alta calidad</span>
        </div>
      </Button>
    </div>
  );
}
