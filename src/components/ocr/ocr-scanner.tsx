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

    // Grayscale and contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const contrast = 1.3;
      let newValue = (avg - 128) * contrast + 128;
      newValue = Math.max(0, Math.min(255, newValue));

      data[i] = newValue;
      data[i + 1] = newValue;
      data[i + 2] = newValue;
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
    let scannedPages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // Attempt text extraction first
      const textContent = await page.getTextContent();
      // Group items by vertical position (y coordinate)
      const textItems = textContent.items as any[];
      const lines: { [key: number]: any[] } = {};

      textItems.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lines[y]) lines[y] = [];
        lines[y].push(item);
      });

      // Sort lines top to bottom and items left to right
      const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
      const pageText = sortedY.map(y => {
        return lines[y]
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map(item => item.str)
          .join(" ");
      }).join("\n");

      if (pageText.trim().length > 100) {
        fullText += pageText + "\n";
      } else {
        // Fallback to OCR for this page
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          const processedImg = preprocessImage(canvas);
          scannedPages.push(processedImg);
        }
      }
    }

    if (scannedPages.length > 0) {
      const worker = await createWorker(["spa", "eng"]);
      for (const img of scannedPages) {
        const { data: { text } } = await worker.recognize(img);
        fullText += text + "\n";
      }
      await worker.terminate();
    }

    return fullText;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const toastId = toast.loading("Analizando documento con alta precisión...");

    try {
      let text = "";

      if (file.type === "application/pdf") {
        text = await processPDF(file);
      } else {
        // Handle Image
        const reader = new FileReader();
        const imgPromise = new Promise<string>((resolve) => {
          reader.onload = (re) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                resolve(re.target?.result as string);
                return;
              }
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
      let items: any[] = [];

      // Extraction Logic
      const orderMatch = text.match(/Orden\s*de\s*Compra\s*(?:N[°º]|Nro\.?|N)?\s*(\d+)/i) ||
                         text.match(/N[°º]\s*(\d+)\s*\n\s*Unidad de Compra/i) ||
                         text.match(/(?:Remito|Ticket|Operaci[óo]n|Nro|N[°º])\s*[:.-]?\s*(\d{4}-\d{8}|\d+[-\d]*)/i);
      if (orderMatch) number = orderMatch[1];

      const cuitMatch = text.match(/(\d{2}-\d{8}-\d{1})/) || text.match(/(\d{11})/);
      if (cuitMatch) cuit = cuitMatch[1];

      const providerMatch = text.match(/Proveedor\s*[:.-]?\s*(\d+)?\s*[-]?\s*([A-Z0-9\s.]{3,})/i) ||
                            text.match(/Se[ñn]or\(es\)\s*[:.-]?\s*([A-Z0-9\s.]{3,})/i);
      if (providerMatch) {
          providerName = (providerMatch[2] || providerMatch[1]).trim().split('\n')[0].trim();
      }

      const dateMatches = text.match(/\d{2}\/\d{2}\/\d{4}/g);
      if (dateMatches) {
          date = dateMatches[0];
          if (dateMatches.length > 1) deliveryDate = dateMatches[1];
      }

      const expedienteMatch = text.match(/(?:Expediente|Suministro|Nro\/A[ñn]o)\s*[:.-]?\s*(\d+\/\d{4})/i);
      if (expedienteMatch) expediente = expedienteMatch[1];

      const delivPlaceMatch = text.match(/(?:S[íi]rvase entregar a|Lugar de entrega)[:.-]?\s*([^\n]+)/i);
      if (delivPlaceMatch) {
        deliveryPlace = delivPlaceMatch[1].split(/(?:C\.U\.I\.T\.|Con domicilio|Localidad|C\.P\.|Fecha de entrega)/i)[0].trim();
      }

      const paymentMatch = text.match(/Condici[óo]n de pago[:.-]?\s*([^\n]+)/i);
      if (paymentMatch) {
        paymentTerms = paymentMatch[1].split(/(?:Plazo de entrega|Aprobado por|Suministro)/i)[0].trim();
      }

      const patenteMatch = text.match(/Patente[:.-]?\s*([A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]{3}\s?\d{3})/i);
      if (patenteMatch) patente = patenteMatch[1].replace(/\s/g, '').toUpperCase();

      const litersMatch = text.match(/(?:Litros|Cant|Cantidad|Volumen|CAN[TI])[:.-]?\s*([\d.,]+)/i) ||
                          text.match(/([\d.,]+)\s*(?:Lts|Litros|L|LTS)/i);
      if (litersMatch) {
          liters = litersMatch[1].replace(',', '.');
      }

      const totalMatch = text.match(/(?:Total|Importe|Suma|Monto|Pagar|Venta)[:.-]?\s*\$?\s*([\d\s.,]{3,})/i) ||
                         text.match(/TOTAL[:\s]*\$?\s*([\d\s.,]{3,})/i);
      if (totalMatch) {
          let rawVal = totalMatch[1].trim().split('\n')[0].trim();
          if (rawVal.includes('.') && rawVal.includes(',')) {
              amount = rawVal.replace(/\./g, '').replace(',', '.');
          } else if (rawVal.includes(',') && !rawVal.includes('.')) {
              amount = rawVal.replace(',', '.');
          } else if (rawVal.match(/\.\d{2}$/)) {
              amount = rawVal;
          } else {
              amount = rawVal.replace(/[.\s]/g, '');
          }
      }

      // Structured Items Extraction (Multi-line support)
      // Pattern: Reng. | Código | Cantidad | U. Medida | Cat.Prog. | Descripción | Importe unitario | Importe total
      // Example: 1 | 2.7.9.10703.0001 | 200,000 | SERVICIO | 24.00.00 | CONFECCIÓN Y COLOCACIÓN... | $ 11.440,00 | 2.288.000,00

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let itemsStarted = false;
      let currentItem: any = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect header (flexible order)
        if (line.match(/Reng\.?/i) && line.match(/Cant/i) && line.match(/Descrip/i)) {
          itemsStarted = true;
          continue;
        }

        if (itemsStarted) {
          // Detect end of items (e.g., "Total: $")
          if (line.match(/Total\s*[:$]/i) || line.match(/Cl[áa]usulas especiales/i) || line.match(/Autorizado por/i)) {
            if (currentItem) items.push(currentItem);
            itemsStarted = false;
            break;
          }

          // Case 1: Standard line [Quantity] [Description] [Reng] $ [UnitPrice] $ [TotalPrice] [Rest...]
          // This matches the user's "Extracted Text" format
          const userFormatMatch = line.match(/^([\d.,]+)\s+(.*?)\s+(\d+)\s+\$\s+([\d.\s,]+)\s+\$\s+([\d.\s,]+)/);

          // Case 2: Old format [Reng] [Code] [Quantity] [UOM] [CatProg] [Description] [Prices]
          const originalFormatMatch = line.match(/^(\d+)\s+([\d.]+)\s+([\d.,]+)\s+([A-Z\s]+)\s+([\d.]+)\s+(.+)/);

          if (userFormatMatch) {
            if (currentItem) items.push(currentItem);

            // Extract UOM from the end of the line if possible
            const uomMatch = line.match(/(?:SERVICIO|UNIDAD|KG|MT|LTS|PAQUETE)$/i);

            currentItem = {
              quantity: userFormatMatch[1].replace(/\./g, '').replace(',', '.'),
              unitOfMeasure: uomMatch ? uomMatch[0] : "UNIDAD",
              description: userFormatMatch[2].trim(),
              unitPrice: userFormatMatch[4].replace(/[.\s]/g, '').replace(',', '.'),
              totalPrice: userFormatMatch[5].replace(/[.\s]/g, '').replace(',', '.')
            };
          } else if (originalFormatMatch) {
            if (currentItem) items.push(currentItem);

            const rawDescription = originalFormatMatch[6];
            const priceMatch = rawDescription.match(/(.*?)\$?\s*([\d.\s,]+)\s*\$?\s*([\d.\s,]+)/);

            currentItem = {
              quantity: originalFormatMatch[3].replace(/\./g, '').replace(',', '.'),
              unitOfMeasure: originalFormatMatch[4].trim(),
              description: priceMatch ? priceMatch[1].trim() : rawDescription.trim(),
              unitPrice: priceMatch ? priceMatch[2].replace(/[.\s]/g, '').replace(',', '.') : "0",
              totalPrice: priceMatch ? priceMatch[3].replace(/[.\s]/g, '').replace(',', '.') : "0"
            };
          } else if (currentItem && line.length > 5 && !line.match(/Total\s*[:$]/i)) {
            // Continuation of description (avoiding total lines)
            currentItem.description += " " + line;
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
        providerName,
        patente,
        liters,
        items
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
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        disabled={isScanning}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <Button
        type="button"
        variant="outline"
        disabled={isScanning}
        className="w-full border-dashed border-2 h-24 flex flex-col gap-2 rounded-2xl hover:bg-blue-50 hover:border-blue-400 transition-all group"
      >
        {isScanning ? (
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        ) : (
          <div className="flex gap-4">
             <Camera className="h-7 w-7 text-blue-500 group-hover:scale-110 transition-transform" />
             <FileText className="h-7 w-7 text-blue-700 group-hover:scale-110 transition-transform" />
          </div>
        )}
        <div className="flex flex-col text-center">
            <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">
              {isScanning ? "Procesando documento..." : "Subir PDF o Foto de Orden"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
                Soporta órdenes digitales y escaneos de alta calidad
            </span>
        </div>
      </Button>
    </div>
  );
}
