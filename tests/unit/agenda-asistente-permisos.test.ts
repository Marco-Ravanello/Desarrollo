import { describe, expect, it } from "vitest";
import { groupByDay, listDayTitle } from "@/lib/agenda";
import { nextReveal, readGeminiSse, safeCut } from "@/lib/assistant-stream";
import { MATRIX_ROLES, ROLE_MATRIX, roleTotals } from "@/lib/role-matrix";

const row = (label: string) => ROLE_MATRIX.flatMap((g) => g.rows).find((r) => r.label === label)!;

describe("Agenda: lista por día", () => {
  const today = new Date(2026, 10, 5, 10, 0);
  it("titula hoy, mañana, ayer y los demás días", () => {
    expect(listDayTitle(new Date(2026, 10, 5, 18), today)).toEqual({ title: "Hoy · jueves 5 de noviembre", relative: "hoy" });
    expect(listDayTitle(new Date(2026, 10, 6), today).title).toBe("Mañana · viernes 6 de noviembre");
    expect(listDayTitle(new Date(2026, 10, 4), today).title).toBe("Ayer · miércoles 4 de noviembre");
    expect(listDayTitle(new Date(2026, 10, 9), today).title).toBe("Lunes 9 de noviembre");
    expect(listDayTitle(new Date(2027, 0, 4), today).title).toBe("Lunes 4 de enero de 2027");
  });

  it("agrupa por día, en orden, y lo que sigue de antes va en hoy", () => {
    const events = [
      { id: "b", startDate: new Date(2026, 10, 6, 9), allDay: false },
      { id: "a", startDate: new Date(2026, 10, 5, 15), allDay: false },
      { id: "c", startDate: new Date(2026, 10, 5, 0), allDay: true },
      { id: "r", startDate: new Date(2026, 10, 3, 8), allDay: false },
    ];
    const groups = groupByDay(events, new Date(2026, 10, 5));
    expect(groups.map((g) => g.key)).toEqual(["2026-11-05", "2026-11-06"]);
    expect(groups[0].items.map((i) => [i.event.id, i.ongoing])).toEqual([
      ["r", true],
      ["c", false],
      ["a", false],
    ]);
    // Viendo también lo anterior, cada cosa va en su día.
    expect(groupByDay(events, null).map((g) => g.key)).toEqual(["2026-11-03", "2026-11-05", "2026-11-06"]);
  });
});

describe("Asistente: la respuesta de a poco", () => {
  it("no corta una máscara por la mitad", () => {
    expect(safeCut("Hola [CIUDA")).toBe(5);
    expect(safeCut("Hola [CIUDADANO_1] y")).toBe(20);
    expect(safeCut("Ver [el detalle")).toBe(15);
  });

  it("lee los eventos de Gemini y guarda lo que quedó a medias", () => {
    const ev = (t: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\r\n\r\n`;
    const { texts, rest } = readGeminiSse(ev("Hay ") + ev("12 expedientes") + "data: {\"cand");
    expect(texts).toEqual(["Hay ", "12 expedientes"]);
    expect(rest).toBe('data: {"cand');
  });

  it("avanza por palabras y termina rápido aunque la respuesta sea larga", () => {
    const text = "Hay doce expedientes abiertos en Protección Social.";
    const first = nextReveal(0, text);
    expect(first).toBeGreaterThan(0);
    expect(text[first] === " " || first === text.length).toBe(true);
    const long = "palabra ".repeat(500);
    let shown = 0;
    let steps = 0;
    while (shown < long.length) {
      shown = nextReveal(shown, long);
      steps++;
    }
    expect(steps).toBeLessThan(120);
  });
});

describe("Permisos por rol", () => {
  it("tiene una columna por rol y el Superadmin puede todo (tomar un expediente, como todos, solo en su área)", () => {
    expect(MATRIX_ROLES).toHaveLength(8);
    const t = roleTotals("SUPERADMIN");
    expect(t.si + t.parcial).toBe(t.total);
    expect(t.parcial).toBe(1);
  });

  it("sale de las mismas reglas que usa la app", () => {
    expect(row("Crear usuarios y dar claves temporales").access("DIRECCION_GENERAL").level).toBe("no");
    expect(row("Aprobar o rechazar órdenes de compra").access("ADMIN_GENERAL").level).toBe("si");
    expect(row("Aprobar o rechazar órdenes de compra").access("DIRECCION_GENERAL").level).toBe("no");
    expect(row("Asignar el profesional a cargo").access("DIRECTOR_AREA")).toEqual({ level: "parcial", note: "Solo en su área" });
    expect(row("Cerrar y reabrir expedientes").access("OPERATIVO").level).toBe("parcial");
    expect(row("Cerrar y reabrir expedientes").access("VIOLENCIA_GENERO").level).toBe("si");
    expect(row("Cargar personas y editar sus datos").access("AUDITOR").level).toBe("no");
    expect(row("Expedientes").access("RELEVADOR_EMERGENCIA").level).toBe("no");
    expect(row("Fichas de emergencia climática").access("RELEVADOR_EMERGENCIA").level).toBe("si");
    expect(row("Asistente de IA").access("DIRECTOR_AREA").level).toBe("parcial");
    expect(row("Permisos por rol (esta tabla)").access("ADMIN_GENERAL").level).toBe("no");
  });
});

describe("Asistente: Gemini escribe de a poco", () => {
  const sse = (pieces: string[]) => {
    const body = pieces.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\r\n\r\n`).join("");
    const bytes = new TextEncoder().encode(body);
    return new Response(
      new ReadableStream({
        start(c) {
          // De a 7 bytes, para que los eventos lleguen cortados.
          for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
          c.close();
        },
      }),
      { status: 200 }
    );
  };

  it("manda los pedazos con los datos reales y sin cortar las máscaras", async () => {
    const { vi } = await import("vitest");
    process.env.GEMINI_API_KEY = "test";
    const long = "La persona tiene un expediente abierto en Protección Social desde marzo y otro cerrado. ".repeat(3);
    const fetchMock = vi.fn(async (url: string, init: any) => {
      const sent = JSON.parse(init.body).contents.at(-1).parts[0].text as string;
      expect(sent).not.toContain("Juana Pérez");
      const token = sent.match(/\[CIUDADANO_\d+\]/)![0];
      return sse([long.slice(0, 50), long.slice(50) + " Es ", token.slice(0, 6), token.slice(6) + "."]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { callGeminiAnonymized } = await import("@/services/gemini-ai");
    const pieces: string[] = [];
    const res = await callGeminiAnonymized("¿Qué tiene Juana Pérez?", "Juana Pérez: 1 expediente abierto.", { names: ["Juana Pérez"] }, [], (t) => pieces.push(t));
    expect(fetchMock.mock.calls[0][0]).toContain(":streamGenerateContent?alt=sse");
    expect(res.streamed).toBe(true);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join("")).toBe(res.answer);
    expect(res.answer.endsWith("Es Juana Pérez.")).toBe(true);
    expect(pieces.some((p) => p.includes("[CIUD"))).toBe(false);
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it("si dice que no encontró datos, no lo manda mientras escribe", async () => {
    const { vi } = await import("vitest");
    process.env.GEMINI_API_KEY = "test";
    vi.stubGlobal("fetch", vi.fn(async () => sse(["No encontré datos en la app ", "para esa pregunta. Probá con otras palabras o con una de las preguntas de ejemplo."])));
    const { callGeminiAnonymized } = await import("@/services/gemini-ai");
    const pieces: string[] = [];
    const res = await callGeminiAnonymized("¿Cuántos?", "Hay 3.", {}, [], (t) => pieces.push(t));
    expect(pieces).toEqual([]);
    expect(res.streamed).toBe(false);
    expect(res.answer).toContain("No encontré datos");
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });
});

describe("Asistente: sin markdown a medio armar", () => {
  it("muestra las filas de tabla enteras y no corta los enlaces", () => {
    const text = "Hay 14.\n\n| Área | Expedientes |\n| --- | --- |\n| [Coordinación de Niñez y Adolescencia](/cases?area=x) | 4 |\n";
    let shown = 0;
    const cuts: string[] = [];
    while (shown < text.length) {
      shown = nextReveal(shown, text);
      cuts.push(text.slice(0, shown));
    }
    for (const c of cuts) {
      const last = c.slice(c.lastIndexOf("\n") + 1);
      if (last.trimStart().startsWith("|")) expect(c.endsWith("|") || c.endsWith("|\n")).toBe(true);
      const open = last.lastIndexOf("[");
      if (open !== -1) expect(last.slice(open)).toMatch(/\]/);
    }
    const link = "Mirá [la lista de expedientes](/cases?quiet=30) para más.";
    const linkStart = link.indexOf("[");
    const linkEnd = link.indexOf(")") + 1;
    let s = 0;
    while (s < link.length) {
      s = nextReveal(s, link);
      expect(s <= linkStart || s >= linkEnd).toBe(true);
    }
  });
});
