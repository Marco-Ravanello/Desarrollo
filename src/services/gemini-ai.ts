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

  // 2. Prompt del sistema con reglas estrictas
  const systemPrompt = `Eres el Asistente Inteligente Municipal.
Responde a la pregunta del usuario utilizando EXCLUSIVAMENTE el [CONTEXTO REAL] provisto.
No inventes información. Conserva las máscaras como [CIUDADANO_1], [DNI_1], [DIRECCION_1] tal cual aparecen en el contexto.`;

  // 3. Lista de modelos candidato a intentar dinámicamente
  const modelCandidates = [
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-1.5-pro"
  ];

  let lastError: Error | null = null;
  let rawGeminiAnswer = "";

  for (const modelName of modelCandidates) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
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
        }
      );

      if (response.ok) {
        const data = await response.json();
        rawGeminiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawGeminiAnswer) {
          console.log(`🌐 [Gemini API] Respuesta exitosa recibida usando modelo '${modelName}'.`);
          lastError = null;
          break;
        }
      } else {
        const errorText = await response.text();
        lastError = new Error(`Error en Gemini API (${modelName} - Status ${response.status}): ${errorText}`);
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
