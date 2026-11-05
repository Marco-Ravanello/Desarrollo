import { sanitizeText } from "@/lib/pii-sanitizer";
import { geminiFunctionDeclarations, validateToolArgs, type ToolCall } from "@/lib/assistant-tools";
import { CASE_LABELS } from "@/lib/case-labels";
import { formatFechaLarga, formatHora, diaAR } from "@/lib/fechas";
import { getGeminiModelCandidates } from "@/services/gemini-ai";

// Gemini elige cuál de las consultas fijas responde la pregunta, y con qué filtros (lib/assistant-tools.ts).
// Le llegan la pregunta y las preguntas anteriores de la conversación, con los DNI y CUIT tapados, y los
// nombres de las áreas y de las etiquetas. No le llega ningún dato de la base.

const PLAN_TIMEOUT_MS = 8000;

export async function planWithGemini(
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
  context: { areaNames: string[]; now?: Date } = { areaNames: [] }
): Promise<ToolCall | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const now = context.now ?? new Date();

  // Solo las preguntas de quien usa el asistente, no las respuestas (que traen datos de la base).
  const previous = history.filter((m) => m.role === "user").slice(-3).map((m) => m.content.slice(0, 300));
  const { sanitizedText, rehydrate } = sanitizeText([...previous, question].join("\n\u0000\n"));
  const parts = sanitizedText.split("\n\u0000\n");
  const sanitizedQuestion = parts.pop() ?? "";

  const instruction = `Sos el asistente de MuniGestión 3F, la app de Desarrollo Humano y Hábitat de Tres de Febrero.
Elegí la consulta que responde la pregunta y completá sus filtros solo con lo que dice la pregunta (o las preguntas anteriores, si la pregunta sigue una charla: "¿y los urgentes?").
Hoy es ${formatFechaLarga(now)} (${diaAR(now)}), son las ${formatHora(now)} en Argentina. "Esta semana", "mañana" o "el jueves" se cuentan desde hoy.
Áreas: ${context.areaNames.join("; ") || "sin datos"}.
Etiquetas de expedientes: ${CASE_LABELS.map((l) => `${l.key} (${l.label})`).join("; ")}.
Los textos como [DNI_1] son datos tapados: copialos tal cual.`;

  const contents = [
    ...parts.map((text) => ({ role: "user", parts: [{ text }] })),
    { role: "user", parts: [{ text: sanitizedQuestion }] },
  ];

  for (const model of getGeminiModelCandidates()) {
    const modelPath = model.startsWith("models/") ? model : `models/${model}`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(PLAN_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents,
          tools: [{ functionDeclarations: geminiFunctionDeclarations() }],
          toolConfig: { functionCallingConfig: { mode: "ANY" } },
          generationConfig: { temperature: 0 },
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const call = (data.candidates?.[0]?.content?.parts ?? []).find((p: any) => p?.functionCall)?.functionCall;
      if (!call?.name) return null;
      const args = validateToolArgs(String(call.name), rehydrateArgs(call.args, rehydrate));
      return args ? { tool: String(call.name), args, via: "gemini" } : null;
    } catch {
      // Se prueba el siguiente modelo; si ninguno responde, se elige por palabras.
    }
  }
  return null;
}

function rehydrateArgs(raw: unknown, rehydrate: (s: string) => string): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
      k,
      typeof v === "string" ? rehydrate(v) : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? rehydrate(x) : x)) : v,
    ])
  );
}
