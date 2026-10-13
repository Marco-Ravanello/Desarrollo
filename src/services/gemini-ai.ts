import { sanitizeText } from "@/lib/pii-sanitizer";

// Modelos vigentes de la API de Gemini (gemini-2.0-flash y 1.5-flash fueron dados de baja).
// GEMINI_MODEL permite elegir otro modelo sin tocar el código.
export function getGeminiModelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const defaults = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"];
  return Array.from(new Set([preferred, cachedModelName, ...defaults].filter(Boolean) as string[]));
}

// Último modelo que respondió bien; se prueba primero en la siguiente consulta.
let cachedModelName: string | null = null;

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

  const candidateModels = getGeminiModelCandidates();

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
            maxOutputTokens: 8192,
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        rawGeminiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawGeminiAnswer) {
          successfulModel = modelPath;
          cachedModelName = modelResource;
          console.log(`🌐 [Gemini API] Respuesta exitosa recibida usando '${successfulModel}'.`);
          lastError = null;
          break;
        }
      } else {
        if (cachedModelName === modelResource) cachedModelName = null; // invalidar caché si falla
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
