import { Fragment } from "react";
import { parseAnswer, type Inline } from "@/lib/assistant-text";

// Una respuesta del asistente, dibujada con React (nunca como HTML): títulos, párrafos, listas y tablas.

const NUMERIC = /^[\s$%+\-.,\d]+$/;

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "bold" ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.text}
          </strong>
        ) : p.kind === "italic" ? (
          <em key={i} className="text-muted-foreground">
            {p.text}
          </em>
        ) : p.kind === "code" ? (
          <span key={i} className="rounded bg-muted px-1 py-0.5 font-medium tabular-nums">
            {p.text}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        )
      )}
    </>
  );
}

const cellText = (parts: Inline[]) => parts.map((p) => p.text).join("");

export function AssistantAnswer({ text }: { text: string }) {
  const blocks = parseAnswer(text);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((b, i) => {
        if (b.type === "title") {
          return b.level === 3 ? (
            <h3 key={i} className="pt-1 font-heading text-base font-semibold text-foreground first:pt-0">
              {b.text}
            </h3>
          ) : (
            <h4 key={i} className="pt-2 text-sm font-semibold text-foreground">
              {b.text}
            </h4>
          );
        }
        if (b.type === "paragraph") {
          return (
            <p key={i}>
              <InlineText parts={b.inline} />
            </p>
          );
        }
        if (b.type === "list") {
          const List = b.ordered ? "ol" : "ul";
          return (
            <List key={i} className={`space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-muted-foreground`}>
              {b.items.map((item, j) => (
                <li key={j} className="pl-0.5">
                  <InlineText parts={item} />
                </li>
              ))}
            </List>
          );
        }
        const numericCol = b.header.map((_, c) => b.rows.length > 0 && b.rows.every((r) => !r[c] || NUMERIC.test(cellText(r[c]))));
        return (
          <div key={i} className="my-3 overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  {b.header.map((h, c) => (
                    <th key={c} scope="col" className={`px-3 py-2 font-medium ${numericCol[c] ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {b.header.map((_, c) => (
                      <td key={c} className={`px-3 py-2 align-top ${numericCol[c] ? "text-right tabular-nums" : ""}`}>
                        <InlineText parts={row[c] ?? []} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
