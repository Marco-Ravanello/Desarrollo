import http from "http";
import { Message } from "./types";

export async function callOllama(messages: Message[]): Promise<string> {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3:8b";

  const hostUrl = new URL(host);
  const hostname = hostUrl.hostname || "127.0.0.1";
  const port = hostUrl.port || "11434";
  const path = "/api/chat";

  const requestBody = JSON.stringify({
    model,
    messages,
    stream: false,
    options: {
      temperature: 0.3,
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname,
      port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody)
      },
      timeout: 300000
    }, (res) => {
      let responseData = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`Ollama API returned status ${res.statusCode}: ${responseData}`));
          return;
        }

        try {
          const data = JSON.parse(responseData);
          resolve(data.message?.content || "");
        } catch (err) {
          reject(new Error(`Failed to parse Ollama JSON response: ${err}`));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Ollama API request timed out (300s). Te recomendamos activar la aceleración por GPU T4 en Google Colab para que las respuestas sean instantáneas."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(requestBody);
    req.end();
  });
}

export async function callOllamaStream(
  messages: Message[],
  onChunk: (chunk: string) => void
): Promise<string> {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3:8b";

  const hostUrl = new URL(host);
  const hostname = hostUrl.hostname || "127.0.0.1";
  const port = hostUrl.port || "11434";
  const path = "/api/chat";

  const requestBody = JSON.stringify({
    model,
    messages,
    stream: true,
    options: {
      temperature: 0.3,
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname,
      port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 300000
    }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`Ollama API returned status ${res.statusCode}`));
        return;
      }

      let buffer = "";
      let fullResponseText = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content || "";
            if (content) {
              fullResponseText += content;
              onChunk(content);
            }
          } catch (err) {}
        }
      });

      res.on("end", () => {
        if (buffer.trim() !== "") {
          try {
            const parsed = JSON.parse(buffer);
            const content = parsed.message?.content || "";
            if (content) {
              fullResponseText += content;
              onChunk(content);
            }
          } catch (err) {}
        }
        resolve(fullResponseText);
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Ollama API request timed out (300s)."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(requestBody);
    req.end();
  });
}
