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
      // Slightly lower contrast factor for low-res screenshots to prevent pixelating anti-aliased text
      const contrast = canvas.width < 1000 ? 1.1 : 1.3;
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
              // Smart upscale for low-res screenshots
              if (w < 1800) { h = h * (1800 / w); w = 1800; }
              canvas.width = w; canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              resolve(preprocessImage(canvas));
            };
            img.src = re.target?.result as string;
          };
          reader.readAsDataURL(file);
        });
        const processedImage = await imgPromise;
        // Use "spa" as primary language for superior speed and Spanish vocabulary accuracy
        const worker = await createWorker(["spa"]);
        const { data: { text: ocrText } } = await worker.recognize(processedImage);
        text = ocrText;
        await worker.terminate();
      }

      console.log("Extracted Text:", text);

      const sanitizePrice = (val: string) => {
        if (!val) return "0";
        // Remove spaces
        let cleaned = val.replace(/\s+/g, '');
        // Remove dots (thousands) and replace comma with dot (decimal)
        let sanitized = cleaned.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(sanitized);
        return isNaN(num) ? "0" : num.toString();
      };

      // 1. Order Number - Matches "N° 253", "Nro 253", "N 253", "No 253"
      const number = (text.match(/N(?:°|º|ro\.?|o\.?|\s+)?\s*[:.-]?\s*(\d+)/i)?.[1]) || "";

      // 2. Order Total
      let amount = "";
      const totalMatch = text.match(/Total\s*[:$]\s*\$?\s*([\d.\s,]{3,})/i) ||
                         text.match(/Importe\s+total\s*[:$]?\s*\$?\s*([\d.\s,]{3,})/i) ||
                         text.match(/TOTAL[:\s]*\$?\s*([\d.\s,]{3,})/i);
      if (totalMatch) amount = sanitizePrice(totalMatch[1].trim());

      // 3. Metadata
      const linesForSearch = text.split('\n').map(l => l.trim());

      // Extract CUIT robustly
      let cuit = "";
      const providerLineWithCuit = linesForSearch.find(l => (l.toLowerCase().includes("provedor") || l.toLowerCase().includes("proveedor") || l.toLowerCase().includes("promador") || l.toLowerCase().includes("cuit") || l.toLowerCase().includes("cult")) && l.match(/(\d{2}-\d{8}-\d{1}|\d{11})/));
      if (providerLineWithCuit) {
          const match = providerLineWithCuit.match(/(\d{2}-\d{8}-\d{1}|\d{11})/);
          if (match) cuit = match[1];
      }
      if (!cuit) {
          // Fallback to any CUIT in the document
          const match = text.match(/(\d{2}-\d{8}-\d{1}|\d{11})/);
          if (match) cuit = match[1];
      }

      // Extract Provider Name robustly from line containing Provider / Proveedor / Promador keywords
      let providerName = "";
      const providerLine = linesForSearch.find(l => l.toLowerCase().includes("provedor") || l.toLowerCase().includes("proveedor") || l.toLowerCase().includes("promador"));
      if (providerLine) {
          const nameMatch = providerLine.match(/[A-Z]{3,}(?:\s+[A-Z.]{2,})+/);
          if (nameMatch) {
              providerName = nameMatch[0].trim();
              providerName = providerName.replace(/\s*(?:C\.?U\.?I\.?T\.?|C\.?U\.?L\.?T\.?|PROVEEDOR|FANTASIA).*$/i, "").trim();
          }
      }
      if (!providerName) {
          const providerMatch = text.match(/Proveedor\s*[:.-]?\s*(\d+)?\s*[-]?\s*([A-Z0-9\s.]{3,})/i);
          providerName = providerMatch?.[2]?.split('\n')[0].trim() || "";
          providerName = providerName.replace(/\s*(?:C\.?U\.?I\.?T\.?|C\.?U\.?L\.?T\.?).*$/i, "").trim();
      }

      const expediente = (text.match(/(?:Expediente|Suministro|Nesto)[\s\S]*?(\d+\/\d{4})/i)?.[1]) || "";

      // Improved Date Extraction
      let date = "";
      let deliveryDate = "";

      // Find date of order (Fecha or Fecha de emisión)
      const orderDateLine = linesForSearch.find(l => l.match(/fecha\s*:\s*\d{2}\/\d{2}\/\d{4}/i));
      if (orderDateLine) {
          const match = orderDateLine.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (match) date = match[1];
      }

      // Find delivery date (Fecha de entrega)
      const deliveryDateLine = linesForSearch.find(l => l.toLowerCase().includes("fecha de entrega") || l.toLowerCase().includes("plazo de entrega"));
      if (deliveryDateLine) {
          const match = deliveryDateLine.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (match) deliveryDate = match[1];
      }

      // Date fallback
      if (!date || !deliveryDate) {
          const dateMatches = text.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
          if (!date && dateMatches.length > 0) date = dateMatches[0];
          if (!deliveryDate && dateMatches.length > 1) {
              // Usually the delivery date is different from order date, or near the end depending on format
              deliveryDate = dateMatches.find(d => d !== date) || dateMatches[dateMatches.length - 1];
          }
      }

      // Improved Place and Payment - avoid searching upwards into headers and handle word misreadings
      let deliveryPlace = "";
      const delivIndex = linesForSearch.findIndex(l =>
          l.toLowerCase().includes("sirva") ||
          l.toLowerCase().includes("entregar") ||
          l.toLowerCase().includes("emrteegar")
      );
      if (delivIndex >= 0) {
          const line = linesForSearch[delivIndex];
          if (line.includes(":") && line.split(":")[1].trim().length > 0) {
              deliveryPlace = line.split(":")[1].trim();
          } else {
              // Try checking the line above (common in pdfjs-dist / OCR layout rendering)
              if (delivIndex > 0 && linesForSearch[delivIndex - 1].trim().length > 0 && !linesForSearch[delivIndex - 1].toLowerCase().includes("domicilio") && !linesForSearch[delivIndex - 1].toLowerCase().includes("cuit") && !linesForSearch[delivIndex - 1].match(/^(?:CEL|T\.E|FAX|E-Mail|TEL)[:.\s]*/i)) {
                  deliveryPlace = linesForSearch[delivIndex - 1].trim();
              } else {
                  // Check the lines immediately below
                  for (let i = delivIndex + 1; i < delivIndex + 4 && i < linesForSearch.length; i++) {
                      const nextLine = linesForSearch[i];
                      if (nextLine && !nextLine.toLowerCase().includes("domicilio") && !nextLine.toLowerCase().includes("cuit") && !nextLine.toLowerCase().includes("lugar")) {
                          deliveryPlace = nextLine;
                          break;
                      }
                  }
              }
          }
      }

      let paymentTerms = "";
      const payIndex = linesForSearch.findIndex(l =>
          l.toLowerCase().includes("condici") ||
          l.toLowerCase().includes("condic") ||
          l.toLowerCase().includes("consic") ||
          (l.toLowerCase().includes("pago") && l.toLowerCase().includes("condi")) ||
          (l.toLowerCase().includes("pago") && l.toLowerCase().includes("consi"))
      );
      if (payIndex >= 0) {
          const line = linesForSearch[payIndex];
          if (line.includes(":")) {
              paymentTerms = line.split(":")[1].trim();
          } else {
              paymentTerms = line;
          }
      }

      // 4. Items Extraction (Tres de Febrero PDF/Image format)
      const items: any[] = [];
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let itemsStarted = false;

      for (const line of lines) {
        if (line.match(/Reng\.?/i) && line.match(/Cant/i) && line.match(/Descrip/i)) {
            itemsStarted = true;
            continue;
        }
        if (itemsStarted) {
          if (line.match(/Total\s*[:$]/i) || line.match(/Cl[áa]usulas/i) || line.match(/Autorizado/i)) {
              itemsStarted = false;
              break;
          }

          // Format: [Renglon] [Codigo] [Quantity] [U.Medida] [CatProg] [Description] $ [UnitPrice] $ [TotalPrice]
          // Handles misread row indices, quantity words/letters, and various currency symbols
          const rowMatch = line.match(/^([0-9\x27\"jJ\s]+)\s+([\d.]+)\s+([A-Z0-9.,\s\-—]+)\s+(SERVICIO|UNIDAD|U\.?\s*MEDIDA|[A-Z]{3,})\s+([-\w\d.]+)?\s*(.*?)(?:[\$\£\ES5]\s*)?([\d.,\s]+)\s*[\$\£\ES5]\s*([\d.,\s]+)$/) ||
                           line.match(/^([0-9\x27\"jJ\s]+)\s+([\d.]+)\s+([A-Z0-9.,\s\-—]+)\s+(SERVICIO|UNIDAD|U\.?\s*MEDIDA|[A-Z]{3,})\s*(.*?)(?:[\$\£\ES5]\s*)?([\d.,\s]+)\s*[\$\£\ES5]\s*([\d.,\s]+)$/);

          if (rowMatch) {
            const qtyRaw = rowMatch[3].trim();
            let quantity = qtyRaw.replace(/[oO]/g, '0');
            const qtyNumMatch = quantity.match(/[\d.,]+/);
            quantity = qtyNumMatch ? sanitizePrice(qtyNumMatch[0]) : "1";

            const description = rowMatch[6] || rowMatch[5] || "";
            const unitPrice = sanitizePrice(rowMatch[rowMatch.length - 2]);
            const totalPrice = sanitizePrice(rowMatch[rowMatch.length - 1]);

            items.push({
              quantity,
              unitOfMeasure: rowMatch[4].trim(),
              description: description.trim(),
              unitPrice,
              totalPrice
            });
          } else if (items.length > 0 && line.length > 5 && !line.includes("$") && !line.includes("Total") && !line.toLowerCase().includes("cláusulas")) {
             items[items.length - 1].description += " " + line;
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
