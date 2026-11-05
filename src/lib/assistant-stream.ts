// Que la respuesta del asistente se vaya escribiendo de a poco. Sin base de datos, para poder probarlo solo.

/**
 * Hasta dónde se puede mandar un texto que todavía está llegando sin cortar una máscara por la mitad
 * ("[CIUDADANO_1]"): si termina en un "[" sin cerrar que parece el comienzo de una, se guarda desde ahí.
 */
export function safeCut(text: string): number {
  const open = text.lastIndexOf("[");
  if (open === -1 || text.indexOf("]", open) !== -1) return text.length;
  return /^\[[A-Z0-9_]{0,40}$/.test(text.slice(open)) ? open : text.length;
}

/**
 * Lee los eventos de Gemini con `alt=sse` ("data: {…}\n\n"). Devuelve los pedazos de texto completos y lo
 * que quedó a medias para la próxima vuelta.
 */
export function readGeminiSse(buffer: string): { texts: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const events = normalized.split("\n\n");
  const rest = events.pop() ?? "";
  const texts: string[] = [];
  for (const event of events) {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const data = JSON.parse(line.slice(5).trim());
        const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts
          .filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("");
        if (text) texts.push(text);
      } catch {
        // Un evento que no es JSON (un comentario o un aviso): se saltea.
      }
    }
  }
  return { texts, rest };
}

/**
 * Cuánto mostrar en el próximo paso de la animación: avanza más rápido cuanto más falta (así una respuesta
 * larga no tarda más de un segundo en aparecer) y termina en el final de una palabra.
 */
export function nextReveal(shown: number, target: string): number {
  if (shown >= target.length) return target.length;
  const backlog = target.length - shown;
  let next = Math.min(target.length, shown + Math.max(3, Math.ceil(backlog / 20)));
  // Hasta el fin de la palabra (con un tope, por si es una línea sin espacios).
  const limit = Math.min(target.length, next + 24);
  while (next < limit && !/\s/.test(target[next])) next++;
  return completeMarkup(target, next);
}

/**
 * Para que no se vea el markdown a medio armar: una fila de tabla ("| … |") aparece entera, y un enlace
 * ("[texto](/ruta)") no se corta antes de cerrarse.
 */
function completeMarkup(target: string, next: number): number {
  const lineStart = target.lastIndexOf("\n", next - 1) + 1;
  let lineEnd = target.indexOf("\n", next);
  if (lineEnd === -1) lineEnd = target.length;
  const line = target.slice(lineStart, lineEnd);
  if (line.trimStart().startsWith("|")) return lineEnd;
  for (const m of line.matchAll(/\[[^\]\n]*\](\([^)\n]*\))?/g)) {
    const start = lineStart + (m.index ?? 0);
    const end = start + m[0].length;
    if (start < next && next < end) return end;
  }
  return next;
}
