// Las respuestas del asistente llegan como texto con un poco de formato (títulos, listas, tablas, negrita).
// Acá se pasan a bloques para dibujarlos con React. Nada se dibuja como HTML: lo que venga escrito
// en un nombre o un título se muestra como texto, aunque tenga signos raros.

export type Inline = { kind: "text" | "bold" | "italic" | "code"; text: string };

export type AnswerBlock =
  | { type: "title"; level: 3 | 4; text: string }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: string[]; rows: Inline[][][] };

const INLINE = /\*\*(.+?)\*\*|`([^`]+?)`|\*([^*\s][^*]*?)\*/g;

/** Negrita (**así**), código (`así`) e itálica (*así*) dentro de un renglón. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: line.slice(last, at) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "code", text: m[2] });
    else out.push({ kind: "italic", text: m[3] });
    last = at + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out.filter((s) => s.text !== "");
}

const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const isTableRow = (line: string) => /^\|.*\|$/.test(line.trim());
const isTableRule = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "");

const BULLET = /^[*-]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;

/** El texto de una respuesta, en bloques para dibujar. */
export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    if (isTableRow(line)) {
      const header = tableCells(line);
      const rows: Inline[][][] = [];
      i++;
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = tableCells(lines[i]);
        if (!isTableRule(cells)) rows.push(cells.map(parseInline));
        i++;
      }
      blocks.push({ type: "table", header: header.map((h) => h.replace(/\*\*/g, "")), rows });
      continue;
    }

    const heading = /^(#{1,6})\s*(.*)$/.exec(line);
    if (heading) {
      const text = heading[2].replace(/\*\*/g, "").replace(/:$/, "").trim();
      if (text) blocks.push({ type: "title", level: heading[1].length <= 3 ? 3 : 4, text });
      i++;
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      const ordered = !bullet;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        const m = ordered ? NUMBERED.exec(l) : BULLET.exec(l);
        if (!m) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    blocks.push({ type: "paragraph", inline: parseInline(line) });
    i++;
  }
  return blocks;
}

/** El texto sin marcas de formato, para copiarlo o leerlo en voz alta. */
export function plainAnswer(text: string): string {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !(isTableRow(l) && isTableRule(tableCells(l))))
    .map((l) =>
      (isTableRow(l) ? tableCells(l).join(" · ") : l)
        .replace(/^#{1,6}\s*/, "")
        .replace(/^[*-]\s+/, "• ")
        .replace(/\*\*|`/g, "")
        .replace(/\*([^*\s][^*]*?)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
