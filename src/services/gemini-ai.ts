import { sanitizeText } from "@/lib/pii-sanitizer";
import { readGeminiSse, safeCut } from "@/lib/assistant-stream";

// La misma frase que usa el asistente cuando no encuentra nada (services/ai-assistant.ts, NO_DATA).
const NO_DATA_TEXT = "No encontré datos en la app para esa pregunta. Probá con otras palabras o con una de las preguntas de ejemplo.";

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
  history?: { role: "user" | "assistant"; content: string }[],
  /** Si está, la respuesta se va mandando a medida que Gemini la escribe (ya con los datos reales). */
  onText?: (text: string) => void
): Promise<{ answer: string; usedGemini: boolean; streamed: boolean }> {
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
  const systemPrompt = `Sos el asistente de MuniGestión 3F, la app de la Secretaría de Desarrollo Humano y Hábitat de Tres de Febrero.
REGLAS:
1. Respondé usando SOLO la información del [CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL]. No inventes números ni nombres.
2. Si el contexto está vacío o dice que no hay datos, respondé exactamente: "${NO_DATA_TEXT}"
3. Conservá las máscaras como [CIUDADANO_1], [DNI_1] o [DIRECCION_1] tal cual aparecen.
4. Escribí en español rioplatense, tratando de vos ("podés", "fijate"), nunca de usted.
5. Usá frases cortas y palabras de todos los días: "expedientes" (no "casos sociales"), "personas" (no "ciudadanos"), "vehículos" (no "flota logística"). Nada de jerga administrativa.
6. Empezá por la respuesta. Usá títulos, listas o tablas en markdown solo si ayudan a leer.`;

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

  const body = JSON.stringify({
    contents: contentsPayload,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    }
  });

  let lastError: Error | null = null;
  let rawGeminiAnswer = "";
  let streamed = false;

  // 4. Ejecutar la llamada a la API. Si un modelo falla antes de escribir algo, se prueba con el siguiente.
  for (const modelResource of candidateModels) {
    const modelPath = modelResource.startsWith("models/") ? modelResource : `models/${modelResource}`;
    try {
      rawGeminiAnswer = onText
        ? await streamFromModel(modelPath, apiKey, body, rehydrate, (text) => {
            streamed = true;
            onText(text);
          })
        : await answerFromModel(modelPath, apiKey, body);
      if (rawGeminiAnswer) {
        cachedModelName = modelResource;
        console.log(`🌐 [Gemini API] Respuesta exitosa recibida usando '${modelPath}'.`);
        lastError = null;
        break;
      }
    } catch (err: any) {
      if (cachedModelName === modelResource) cachedModelName = null; // invalidar caché si falla
      lastError = err;
    }
    // Ya se mostró una parte: no se puede empezar de nuevo con otro modelo.
    if (streamed) break;
  }

  if (lastError || !rawGeminiAnswer) {
    const error: Error & { partial?: boolean } = lastError || new Error("No se pudo obtener respuesta de ningún modelo de Gemini API.");
    error.partial = streamed;
    throw error;
  }

  // 5. Rehidratar la respuesta de la nube localmente en el servidor antes de mostrarla al usuario
  const finalAnswer = rehydrate(rawGeminiAnswer);
  console.log("🔓 [PII Sanitizer] Respuesta rehidratada localmente con datos reales.");

  return {
    answer: finalAnswer,
    usedGemini: true,
    streamed
  };
}

async function answerFromModel(modelPath: string, apiKey: string, body: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) {
    throw new Error(`Error en Gemini API (${modelPath} - Status ${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Lo primero que escribe se guarda un momento: si es "no encontré datos", el asistente muestra los datos de
// la app en su lugar (services/ai-assistant.ts) y no conviene que aparezca escrito y después se borre.
const HOLD_FIRST_CHARS = NO_DATA_TEXT.length + 40;
const NO_DATA_START = NO_DATA_TEXT.slice(0, 28).toLowerCase();

/** La respuesta de un modelo, mandada de a pedazos con los datos reales. Devuelve el texto entero (con máscaras). */
async function streamFromModel(
  modelPath: string,
  apiKey: string,
  body: string,
  rehydrate: (text: string) => string,
  onText: (text: string) => void
): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Error en Gemini API (${modelPath} - Status ${response.status}): ${await response.text().catch(() => "")}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let sent = 0;
  const flush = (final: boolean) => {
    if (sent === 0 && !final && raw.length < HOLD_FIRST_CHARS) return;
    if (raw.toLowerCase().includes(NO_DATA_START)) return;
    const upTo = final ? raw.length : safeCut(raw);
    if (upTo > sent) {
      onText(rehydrate(raw.slice(sent, upTo)));
      sent = upTo;
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { texts, rest } = readGeminiSse(buffer);
    buffer = rest;
    raw += texts.join("");
    flush(false);
  }
  const { texts } = readGeminiSse(buffer + "\n\n");
  raw += texts.join("");
  flush(true);
  return raw;
}
