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

  // 2. Lista de modelos activos priorizando gemini-3.6-flash (exigido por Google para claves nuevas)
  const candidateModels = [
    "models/gemini-3.6-flash",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-3.6-pro"
  ];

  // Auto-descubrir dinámicamente filtrando modelos discontinuados (como 2.5-flash)
  try {
    const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listResp.ok) {
      const listData = await listResp.json();
      const validModels = (listData.models || []).filter((m: any) =>
        m.supportedGenerationMethods &&
        m.supportedGenerationMethods.includes("generateContent") &&
        !m.name.includes("2.5-flash") // Excluir modelo discontinuado
      );
      if (validModels.length > 0) {
        validModels.forEach((m: any) => {
          if (!candidateModels.includes(m.name)) {
            candidateModels.unshift(m.name);
          }
        });
      }
    }
  } catch (listErr) {
    console.warn("⚠️ ListModels fallback:", listErr);
  }

  let lastError: Error | null = null;
  let rawGeminiAnswer = "";
  let successfulModel = "";

  // 3. Ejecutar llamada al primer modelo disponible
  for (const modelResource of candidateModels) {
    const modelPath = modelResource.startsWith("models/") ? modelResource : `models/${modelResource}`;
    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

    try {
      const systemPrompt = `Eres el Asistente Inteligente Municipal.
Responde a la pregunta del usuario utilizando EXCLUSIVAMENTE el [CONTEXTO REAL] provisto.
No inventes información. Conserva las máscaras como [CIUDADANO_1], [DNI_1], [DIRECCION_1] tal cual aparecen en el contexto.`;

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

      if (response.ok) {
        const data = await response.json();
        rawGeminiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawGeminiAnswer) {
          successfulModel = modelPath;
          console.log(`🌐 [Gemini API] Respuesta exitosa recibida usando '${successfulModel}'.`);
          lastError = null;
          break;
        }
      } else {
        const errorText = await response.text();
        lastError = new Error(`Error en Gemini API (${modelPath} - Status ${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (lastError || !rawGeminiAnswer) {
    throw lastError || new Error("No se pudo obtener respuesta de ningún modelo de Gemini API.");
  }

  // 4. Rehidratar la respuesta de la nube localmente en el servidor antes de mostrarla al usuario
  const finalAnswer = rehydrate(rawGeminiAnswer);
  console.log("🔓 [PII Sanitizer] Respuesta rehidratada localmente con datos reales.");

  return {
    answer: finalAnswer,
    usedGemini: true
  };
}
