"use server";

import { auth } from "@/auth";
import { canUseAiAssistant } from "@/lib/permissions";
import { queryAIAssistant, AIResponse } from "@/services/ai-assistant";

export async function queryAssistantAction(
  queryText: string,
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<AIResponse> {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
  }
  if (!canUseAiAssistant(session.user.role)) {
    return { intent: "error", answer: "Tu rol no tiene acceso al Asistente de IA." };
  }

  try {
    return await queryAIAssistant(queryText, history, session.user.id);
  } catch (error: any) {
    console.error("Error running queryAssistantAction:", error);
    return {
      intent: "error",
      answer: `⚠️ Error del servidor al procesar la consulta: ${error.message || error}`
    };
  }
}
