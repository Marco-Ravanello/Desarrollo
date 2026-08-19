import { sanitizeText } from "@/lib/pii-sanitizer";

export async function callGeminiAnonymized(
  userQuery: string,
  dbContextText: string,
  knownEntities?: { names?: string[]; addresses?: string[] },
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<{ answer: string; usedGemini: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno.");
  }

  // 1. Sanitizar el contexto y la consulta localmente en el servidor
  const fullRawText = `[CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL]:\n${dbContextText}\n\n[PREGUNTA ACTUAL DEL USUARIO]:\n${userQuery}`;
  const { sanitizedText, rehydrate } = sanitizeText(fullRawText, knownEntities);
  console.log("🔒 [PII Sanitizer] Prompt anonimizado exitosamente antes de enviar a Gemini.");

  // 2. Lista de modelos candidato priorizando modelos de texto reales (excluyendo robótica y previews viejos)
  const candidateModels = [
    "models/gemini-3.6-flash",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-3.6-pro"
  ];

  // Auto-descubrir modelos disponibles en la API key evitando modelos de robótica o discontinuados
  try {
    const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listResp.ok) {
      const listData = await listResp.json();
      const validModels = (listData.models || []).filter((m: any) =>
        m.supportedGenerationMethods &&
        m.supportedGenerationMethods.includes("generateContent") &&
        !m.name.includes("robotics") && // Excluir modelos de robótica
        !m.name.includes("preview") &&  // Excluir previews de desarrollo
        !m.name.includes("2.5-flash")  // Excluir modelo discontinuado
      );
      if (validModels.length > 0) {
        const bestTextModel = validModels.find((m: any) => m.name.includes("3.6-flash")) ||
                              validModels.find((m: any) => m.name.includes("2.0-flash")) ||
                              validModels.find((m: any) => m.name.includes("1.5-flash")) ||
                              validModels[0];
        if (bestTextModel && !candidateModels.includes(bestTextModel.name)) {
          candidateModels.unshift(bestTextModel.name);
        }
      }
    }
  } catch (listErr) {
    console.warn("⚠️ ListModels fallback:", listErr);
  }

  // 3. Reconstruir historial conversacional continuo para Gemini
  const contentsPayload: any[] = [];
  const systemPrompt = `Eres el Asistente Inteligente Municipal de MuniGestión.
REGLAS ABSOLUTAS DE VERACIDAD:
1. Responde utilizando EXCLUSIVAMENTE la información provista en el [CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL].
2. Si el contexto está vacío o indica que no hay registros, responde: "No se encontraron registros en la base de datos municipal para esta consulta."
3. Conserva las máscaras como [CIUDADANO_1], [DNI_1], [DIRECCION_1] tal cual aparecen en el contexto.`;

  if (history && history.length > 0) {
    // Agregar hasta los últimos 6 mensajes del historial conversacional
    const recentHistory = history.slice(-6);
    recentHistory.forEach(msg => {
      const { sanitizedText: sanitizedMsg } = sanitizeText(msg.content, knownEntities);
      contentsPayload.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: sanitizedMsg }]
      });
    });
  }

  // Agregar el mensaje y contexto actual
  contentsPayload.push({
    role: "user",
    parts: [{ text: `${systemPrompt}\n\n${sanitizedText}` }]
  });

  let lastError: Error | null = null;
  let rawGeminiAnswer = "";
  let successfulModel = "";

  // 4. Ejecutar la llamada a la API
  for (const modelResource of candidateModels) {
    const modelPath = modelResource.startsWith("models/") ? modelResource : `models/${modelResource}`;
    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: contentsPayload,
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

  // 5. Rehidratar la respuesta de la nube localmente en el servidor antes de mostrarla al usuario
  const finalAnswer = rehydrate(rawGeminiAnswer);
  console.log("🔓 [PII Sanitizer] Respuesta rehidratada localmente con datos reales.");

  return {
    answer: finalAnswer,
    usedGemini: true
  };
}
