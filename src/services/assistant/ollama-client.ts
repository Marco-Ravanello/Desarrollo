import { Message } from "./types";

export async function callOllama(messages: Message[]): Promise<string> {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3:8b";
  const endpoint = new URL("/api/chat", host).toString();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: 0.3,
        }
      }),
      signal: AbortSignal.timeout(300000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || "";
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error("Ollama API request timed out (300s).");
    }
    throw err;
  }
}

export async function callOllamaStream(
  messages: Message[],
  onChunk: (chunk: string) => void
): Promise<string> {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3:8b";
  const endpoint = new URL("/api/chat", host).toString();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: 0.3,
        }
      }),
      signal: AbortSignal.timeout(300000)
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`Ollama API streaming error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullResponseText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content || "";
          if (content) {
            fullResponseText += content;
            onChunk(content);
          }
        } catch (parseErr) {
          // Ignorar fragmentos parciales o no JSON
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        const content = parsed.message?.content || "";
        if (content) {
          fullResponseText += content;
          onChunk(content);
        }
      } catch (err) {}
    }

    return fullResponseText;
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new Error("Ollama API request timed out (300s).");
    }
    throw err;
  }
}
