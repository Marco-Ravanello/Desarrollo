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
      textItems.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!linesMap[y]) linesMap[y] = [];
        linesMap[y].push(item);
      });
      const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
      fullText += sortedY.map(y => linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(" ")).join("\n") + "\n";
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
        val = val.trim().replace(/^\$/, '').trim();
        if (val.includes('.') && val.includes(',')) {
          const parts = val.split(',');
          const decimals = parts.pop() || "00";
          const integer = parts.join('').replace(/\./g, '');
          return `${integer}.${decimals}`;
        }
        if (val.includes(',') && val.split(',').pop()?.length <= 3) return val.replace(',', '.');
        return val.replace(/[.\s]/g, '');
      };

      // 1. Order Number
      const orderNumMatch = text.match(/Orden\s+de\s+Compra.*?N[°º]\s*(\d+)/i) ||
                            text.match(/N[°º]\s*(\d+)\s*\n\s*Unidad de Compra/i);
      const number = orderNumMatch?.[1] || "";

      // 2. Order Total
      let amount = "";
      const totalMatch = text.match(/Total:\s*\$?\s*([\d.\s,]{3,})/i) ||
                         text.match(/Total\s*\$?\s*([\d.\s,]{3,})/i) ||
                         text.match(/Importe\s+total\s*\$?\s*([\d.\s,]{3,})/i);
      if (totalMatch) amount = sanitizePrice(totalMatch[1].trim().split(/\s{2,}/)[0]);

      // 3. Metadata
      const cuitMatch = text.match(/C\.?U\.?I\.?T\.?.*?(\d{2}-\d{8}-\d{1}|\d{11})/i);
      const cuit = cuitMatch?.[1] || "";

      const providerMatch = text.match(/Proveedor\s*[:.-]?\s*(\d+)?\s*[-]?\s*([A-Z0-9\s.]{3,})/i);
      const providerName = providerMatch?.[2]?.split('\n')[0].trim() || "";

      const expMatch = text.match(/(?:Expediente|Suministro).*?(\d+\/\d{4})/i);
      const expediente = expMatch?.[1] || "";

      const dateMatches = text.match(/\d{2}\/\d{2}\/\d{4}/g);
      const date = dateMatches?.[0] || "";
      let deliveryDate = "";
      if (dateMatches && dateMatches.length > 1) {
          deliveryDate = (dateMatches[1].includes("2026") && dateMatches.length > 2) ? dateMatches[2] : dateMatches[1];
      }

      const delivPlaceMatch = text.match(/(?:S[íi]rvase entregar a|Lugar de entrega)[:.-]?\s*(.*?)(?=\s*(?:C\.?U\.?I\.?T\.?|Con domicilio|Localidad|C\.P\.|Fecha|Condici[óo]n|Aprobado|$))/i);
      const deliveryPlace = delivPlaceMatch?.[1]?.replace(/\n/g, ' ').trim() || "";

      const payTermsMatch = text.match(/Condici[óo]n de pago[:.-]?\s*(.*?)(?=\s*(?:Plazo de entrega|Aprobado por|Suministro|Fecha|N[°º] Solicitud|Expediente|$))/i);
      const paymentTerms = payTermsMatch?.[1]?.replace(/\n/g, ' ').trim() || "";

      // 4. Items Extraction
      const items: any[] = [];
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let itemsStarted = false;
      let currentItem: any = null;

      for (const line of lines) {
        if (line.match(/Reng\.?/i) && line.match(/Cant/i) && line.match(/Descrip/i)) { itemsStarted = true; continue; }
        if (itemsStarted) {
          if (line.match(/Total\s*[:$]/i) || line.match(/Cl[áa]usulas especiales/i) || line.match(/Autorizado por/i)) {
            if (currentItem) items.push(currentItem);
            itemsStarted = false; break;
          }
          const quantityMatch = line.match(/^([\d.,]+)\s+/);
          const priceMatches = Array.from(line.matchAll(/\$\s*([\d.\s,]{3,})/g)).map(m => sanitizePrice(m[1]));
          if (quantityMatch && priceMatches.length >= 2) {
            if (currentItem) items.push(currentItem);
            const startOfPrices = line.indexOf('$');
            const endOfQuantity = quantityMatch[0].length;
            let desc = line.substring(endOfQuantity, startOfPrices).trim().replace(/\s+\d+$/, '').trim();
            currentItem = {
              quantity: quantityMatch[1].replace(/\./g, '').replace(',', '.'),
              unitOfMeasure: line.match(/(?:SERVICIO|UNIDAD|KG|MT|LTS|PAQUETE)$/i)?.[0] || "UNIDAD",
              description: desc,
              unitPrice: parseFloat(priceMatches[0]).toString(),
              totalPrice: parseFloat(priceMatches[1]).toString()
            };
          } else if (currentItem && line.length > 5 && !line.match(/Total\s*[:$]/i)) {
            currentItem.description += " " + line;
          }
        }
      }

      onScanComplete({
        number, amount, cuit, date, expediente,
        deliveryDate, deliveryPlace, paymentTerms,
        description: "", providerName, items
      });
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
