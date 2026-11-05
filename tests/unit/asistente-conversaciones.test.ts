import { describe, expect, it } from "vitest";
import {
  CONVERSATION_RETENTION_DAYS,
  conversationCutoff,
  conversationDayLabel,
  conversationExpiresAt,
  conversationTitle,
  isAppPath,
  storedAnswerData,
} from "@/lib/assistant-conversations";
import { answerLink, answerStat, isSafeAppLink, parseAnswer, parseInline, plainAnswer } from "@/lib/assistant-text";
import { chartColors, chartFileName, chartSheetRows, formatChartValue, horizontalBars, share } from "@/lib/assistant-chart";
import { CHART_COLORS, toneColor } from "@/lib/chart-colors";

describe("conversaciones guardadas", () => {
  it("se borran a los 10 días de la última pregunta", () => {
    expect(CONVERSATION_RETENTION_DAYS).toBe(10);
    const now = new Date("2026-11-15T12:00:00Z");
    expect(conversationCutoff(now).toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(conversationExpiresAt(new Date("2026-11-05T12:00:00Z")).toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });

  it("el nombre es la primera pregunta en un renglón, recortada", () => {
    expect(conversationTitle("  ¿Cuántos\n expedientes   hay? ")).toBe("¿Cuántos expedientes hay?");
    expect(conversationTitle("")).toBe("Conversación");
    const long = conversationTitle("a".repeat(200));
    expect(long.length).toBe(80);
    expect(long.endsWith("…")).toBe(true);
  });

  it("guarda solo lo que se dibuja, y solo enlaces de la app", () => {
    const data = storedAnswerData({
      hasResults: true,
      people: [{ dni: "1", phone: "11" }],
      stats: [{ label: "Abiertos", value: "3", href: "/cases" }, { label: "Raro", value: "1", href: "https://afuera.com" }],
      sources: [{ name: "Ficha", url: "javascript:alert(1)" }],
      actions: [{ label: "Ver", actionType: "NAVIGATE", payload: { path: "//afuera.com" } }],
      chart: { type: "bar", title: "T", data: [{ name: "A", value: 2, tone: "red" }], color: "#fff" },
      proposal: { kind: "tarea", titulo: "Llamar", fecha: "2026-11-06", hora: null, otro: "x", detalle: [{ label: "Tarea", value: "Llamar" }] },
    })!;
    expect(data.people).toBeUndefined();
    expect(data.hasResults).toBeUndefined();
    expect(data.stats).toEqual([{ label: "Abiertos", value: "3", href: "/cases" }, { label: "Raro", value: "1" }]);
    expect(data.sources).toEqual([{ name: "Ficha" }]);
    expect(data.actions).toEqual([{ label: "Ver", actionType: "OPEN_DIALOG" }]);
    expect(data.chart).toEqual({ type: "bar", title: "T", data: [{ name: "A", value: 2, tone: "red" }] });
    expect(data.proposal).toEqual({ kind: "tarea", titulo: "Llamar", fecha: "2026-11-06", hora: null, detalle: [{ label: "Tarea", value: "Llamar" }] });
    expect(storedAnswerData({ hasResults: false })).toBeNull();
    expect(storedAnswerData({ proposalResult: { step: "done", message: "Listo", link: "/tasks" } })).toEqual({ proposalResult: { step: "done", message: "Listo", link: "/tasks" } });
  });

  it("rutas de la app sí, enlaces afuera no", () => {
    expect(isAppPath("/cases?priority=URGENTE")).toBe(true);
    expect(isAppPath("//afuera.com")).toBe(false);
    expect(isAppPath("/\\afuera.com")).toBe(false);
    expect(isAppPath("https://afuera.com")).toBe(false);
    expect(isAppPath(3)).toBe(false);
  });

  it("los días de la lista", () => {
    const now = new Date("2026-11-05T15:00:00Z");
    expect(conversationDayLabel(new Date("2026-11-05T13:00:00Z"), now)).toBe("Hoy");
    expect(conversationDayLabel(new Date("2026-11-04T13:00:00Z"), now)).toBe("Ayer");
    expect(conversationDayLabel(new Date("2026-11-02T13:00:00Z"), now)).toMatch(/^Lunes, 2 de noviembre/);
  });
});

describe("enlaces y números en las respuestas", () => {
  it("los enlaces a la app se dibujan como enlaces; los de afuera, como texto", () => {
    expect(parseInline("Ver [Niñez](/cases?area=1) hoy")).toEqual([
      { kind: "text", text: "Ver " },
      { kind: "link", text: "Niñez", href: "/cases?area=1" },
      { kind: "text", text: " hoy" },
    ]);
    expect(parseInline("[clic](javascript:alert(1))")[0]).toMatchObject({ kind: "text" });
    expect(parseInline("[clic](https://afuera.com)")).toEqual([{ kind: "text", text: "clic" }]);
    expect(parseInline("[clic](//afuera.com)")).toEqual([{ kind: "text", text: "clic" }]);
    expect(isSafeAppLink("/people/123")).toBe(true);
  });

  it("answerLink limpia el nombre para que no rompa la tabla ni el enlace", () => {
    expect(answerLink("Pérez | [Juan]", "/people/1")).toBe("[Pérez Juan](/people/1)");
    expect(answerLink("Afuera", "https://x.com")).toBe("Afuera");
    const table = parseAnswer(`| Persona | DNI |\n| :--- | ---: |\n| ${answerLink("Pérez, Ana", "/people/30111222")} | 30111222 |`);
    expect(table[0]).toMatchObject({ type: "table", rows: [[[{ kind: "link", text: "Pérez, Ana", href: "/people/30111222" }], [{ kind: "text", text: "30111222" }]]] });
    expect(plainAnswer("Ver [Niñez](/cases)")).toBe("Ver Niñez");
  });

  it("answerStat escribe el número como en Argentina y pinta de naranja solo si hay algo", () => {
    expect(answerStat("Abiertos", 1234, { href: "/cases" })).toEqual({ label: "Abiertos", value: "1.234", href: "/cases" });
    expect(answerStat("Urgentes", 0, { attention: true })).toEqual({ label: "Urgentes", value: "0" });
    expect(answerStat("Urgentes", 2, { attention: true }).tone).toBe("attention");
  });
});

describe("gráficos del asistente", () => {
  it("colores con sentido cuando los datos traen tono; si no, un solo azul en las barras", () => {
    const priority = { type: "bar", data: [{ name: "Urgente", value: 3, tone: "red" }, { name: "Alta", value: 2, tone: "orange" }] };
    expect(chartColors(priority, false)).toEqual([toneColor("red", false), toneColor("orange", false)]);
    const areas = { type: "bar", data: [{ name: "Niñez", value: 3 }, { name: "Hábitat", value: 2 }] };
    expect(chartColors(areas, false)).toEqual([CHART_COLORS[0], CHART_COLORS[0]]);
    const pie = { type: "pie", data: [{ name: "A", value: 3 }, { name: "B", value: 2 }] };
    expect(chartColors(pie, false)).toEqual([CHART_COLORS[0], CHART_COLORS[1]]);
  });

  it("barras acostadas con muchos datos o nombres largos", () => {
    expect(horizontalBars([{ name: "Urgente", value: 1 }])).toBe(false);
    expect(horizontalBars([{ name: "Dirección de Niñez y Adolescencia", value: 1 }])).toBe(true);
    expect(horizontalBars(Array.from({ length: 7 }, (_, i) => ({ name: `${i}`, value: i })))).toBe(true);
  });

  it("valores, porcentajes y planilla de Excel", () => {
    expect(formatChartValue(1500000, "pesos")).toBe("$ 1.500.000");
    expect(formatChartValue(1500)).toBe("1.500");
    expect(share(1, 4)).toBe("25 %");
    expect(share(1, 1000)).toBe("menos de 1 %");
    expect(chartSheetRows({ columns: ["Área", "Expedientes"], data: [{ name: "Niñez", value: 3 }] })).toEqual([{ Área: "Niñez", Expedientes: 3 }]);
    expect(chartSheetRows({ data: [{ name: "X", value: 1 }] })).toEqual([{ Categoría: "X", Cantidad: 1 }]);
    expect(chartFileName("Expedientes abiertos por área", new Date("2026-11-05T15:00:00Z"))).toBe("expedientes-abiertos-por-area-2026-11-05.xlsx");
  });
});
