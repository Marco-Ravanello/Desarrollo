import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo válido" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "GEMINI_API_KEY no configurada. Configure la clave de IA para OCR automático."
      }, { status: 503 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "application/pdf";

    const promptText = `Eres un asistente de digitalización de documentos administrativos y órdenes de compra de la Municipalidad de Tres de Febrero.
Analiza el documento adjunto y extrae EXCLUSIVAMENTE un objeto JSON válido con los siguientes campos:
{
  "number": "número de orden de compra o remito (string con solo dígitos o código)",
  "amount": "monto total en pesos (número o string numérico, ej: 154200.50)",
  "cuit": "cuit del proveedor en formato xx-xxxxxxxx-x o números continuos",
  "providerName": "razón social o nombre del proveedor",
  "providerNumber": "número de legajo de proveedor si figura",
  "expediente": "número de expediente administrativo (ej: 4000-1234/2026)",
  "date": "fecha del documento (DD/MM/AAAA)",
  "deliveryDate": "fecha o plazo de entrega",
  "deliveryPlace": "lugar de entrega de los insumos",
  "paymentTerms": "condiciones de pago",
  "description": "resumen breve del objeto de la contratación",
  "items": [
    {
      "quantity": "cantidad numérica",
      "unitOfMeasure": "unidad (unidades, litros, resmas, kg, etc.)",
      "description": "detalle o descripción del insumo",
      "unitPrice": "precio unitario",
      "totalPrice": "precio total del renglón"
    }
  ]
}
Responde únicamente con el JSON sin bloques markdown ni texto introductorio.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Error en servicio de IA: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsedData = JSON.parse(rawJson);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("OCR Route Error:", error);
    return NextResponse.json({ error: error.message || "Error al procesar el archivo" }, { status: 500 });
  }
}
