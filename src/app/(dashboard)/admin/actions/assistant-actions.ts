"use server";

import { auth } from "@/auth";
import { queryAIAssistant, AIResponse } from "@/services/ai-assistant";

export async function queryAssistantAction(queryText: string): Promise<AIResponse> {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error("No autorizado. Debe iniciar sesión.");
  }

  try {
    return await queryAIAssistant(queryText);
  } catch (error: any) {
    console.error("Error running queryAssistantAction:", error);
    return {
      intent: "error",
      answer: `⚠️ Error del servidor al procesar la consulta: ${error.message || error}`
    };
  }
}
