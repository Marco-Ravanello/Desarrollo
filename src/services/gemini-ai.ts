import { sanitizeText, SanitizedPayload } from "@/lib/pii-sanitizer";

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

  // 3. Llamar a la API de Gemini 1.5 Flash (Free Tier)
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
    throw new Error(`Error en Gemini API (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawGeminiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // 4. Rehidratar la respuesta de la nube localmente en el servidor antes de mostrarla al usuario
  const finalAnswer = rehydrate(rawGeminiAnswer);
  console.log("🔓 [PII Sanitizer] Respuesta rehidratada localmente con datos reales.");

  return {
    answer: finalAnswer,
    usedGemini: true
  };
}
