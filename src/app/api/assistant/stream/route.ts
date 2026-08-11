import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryAIAssistantStream } from "@/services/ai-assistant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "No autorizado. Inicie sesión para continuar." }, { status: 401 });
  }

  try {
    const { query, history } = await req.json();
    if (!query || typeof query !== "string" || query.trim() === "") {
      return NextResponse.json({ error: "La consulta no puede estar vacía." }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await queryAIAssistantStream(
            query,
            history,
            session.user.id,
            (chunk: string) => {
              const data = JSON.stringify({ chunk });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          );
          const metaData = JSON.stringify({
            done: true,
            intent: result.intent,
            dataSummary: result.dataSummary
          });
          controller.enqueue(encoder.encode(`event: metadata\ndata: ${metaData}\n\n`));
          controller.close();
        } catch (err: any) {
          console.error("Streaming error in /api/assistant/stream:", err);
          const errorMsg = JSON.stringify({ error: err?.message || "Error en el servidor de IA local" });
          controller.enqueue(encoder.encode(`event: error\ndata: ${errorMsg}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error in assistant stream route:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
