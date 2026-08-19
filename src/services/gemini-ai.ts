import { sanitizeText } from "@/lib/pii-sanitizer";

export async function callGeminiAnonymized(
  userQuery: string,
  dbContextText: string,
  knownEntities?: { names?: string[]; addresses?: string[] }
): Promise<{ answer: string; usedGemini: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno.");
  }

  // 1. Sanitizar el contexto y la consulta localmente en el servidor
  const fullRawText = `[CONTEXTO REAL]:\n${dbContextText}\n\n[PREGUNTA]:\n${userQuery}`;
  const { sanitizedText, rehydrate } = sanitizeText(fullRawText, knownEntities);
  console.log("🔒 [PII Sanitizer] Prompt anonimizado exitosamente antes de enviar a Gemini.");

  // 2. Auto-descubrir dinámicamente los modelos de Gemini habilitados para esta API Key específica
  let activeModelResource = "models/gemini-1.5-flash";
  try {
    const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listResp.ok) {
      const listData = await listResp.json();
      const validModels = (listData.models || []).filter((m: any) =>
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
      );
      if (validModels.length > 0) {
        // Priorizar modelos 'flash' o tomar el primero disponible para esta API key
        const preferred = validModels.find((m: any) => m.name.includes("flash")) || validModels[0];
        activeModelResource = preferred.name;
        console.log(`🌐 [Gemini API] Modelo activo detectado automáticamente: '${activeModelResource}'`);
      } else {
        console.warn("⚠️ ListModels no devolvió modelos con generateContent, usando valor por defecto.");
      }
    } else {
      console.warn(`⚠️ ListModels devolvió estatus ${listResp.status}, usando modelo por defecto.`);
    }
  } catch (listErr) {
    console.warn("⚠️ Error en consulta de ListModels, usando modelo por defecto:", listErr);
  }

  // Formatear endpoint dinámico
  const modelPath = activeModelResource.startsWith("models/") ? activeModelResource : `models/${activeModelResource}`;
  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

  // 3. Prompt del sistema con reglas strictly prohibidas de inventar
  const systemPrompt = `Eres el Asistente Inteligente Municipal.
Responde a la pregunta del usuario utilizando EXCLUSIVAMENTE el [CONTEXTO REAL] provisto.
No inventes información. Conserva las máscaras como [CIUDADANO_1], [DNI_1], [DIRECCION_1] tal cual aparecen en el contexto.`;

  // 4. Llamada a la API de Gemini con el modelo auto-descubierto
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${systemPrompt}\n\n${sanitizedText}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en Gemini API (${activeModelResource} - Status ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawGeminiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!rawGeminiAnswer) {
    throw new Error("Respuesta vacía obtenida de Gemini API.");
  }

  // 5. Rehidratar la respuesta de la nube localmente en el servidor antes de mostrarla al usuario
  const finalAnswer = rehydrate(rawGeminiAnswer);
  console.log("🔓 [PII Sanitizer] Respuesta rehidratada localmente con datos reales.");

  return {
    answer: finalAnswer,
    usedGemini: true
  };
}
