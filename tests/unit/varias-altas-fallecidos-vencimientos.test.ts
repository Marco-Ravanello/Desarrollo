import { describe, expect, it } from "vitest";
import { BULK_MAX, bulkSummary, parseDniList } from "@/lib/program-bulk";
import { checkExpiry, documentKindLabel, documentNameWithoutFile, expiryState, isDocumentKind } from "@/lib/document-kinds";
import { canUndoPersonStatus, isPersonStatus, personStatusText, withdrawReason } from "@/lib/person-status";
import { expiryNotice } from "@/lib/vencimientos";
import { pickRoute, routingText } from "@/lib/assistant-routing";
import { routeToToolCall, findTool } from "@/lib/assistant-tools";

describe("lista de DNI pegada", () => {
  it("acepta puntos, comas y renglones, sin repetir y sin ceros adelante", () => {
    const r = parseDniList("30.123.456\n28456789, 30123456; 012345678\thola 12");
    expect(r.dnis).toEqual(["30123456", "28456789", "12345678"]);
    expect(r.invalid).toEqual(["hola", "12"]);
    expect(r.tooMany).toBe(false);
  });

  it("corta en el máximo y avisa", () => {
    const text = Array.from({ length: BULK_MAX + 5 }, (_, i) => String(20000000 + i)).join("\n");
    const r = parseDniList(text);
    expect(r.dnis).toHaveLength(BULK_MAX);
    expect(r.tooMany).toBe(true);
  });

  it("resume lo que se hizo", () => {
    expect(bulkSummary("alta", { done: 3, skipped: [] })).toBe("Listo: se dieron 3 altas.");
    expect(bulkSummary("baja", { done: 1, skipped: [{ dni: "1", nombre: null, reason: "x" }] })).toBe("Listo: se dio 1 baja. 1 no se pudo.");
    expect(bulkSummary("alta", { done: 0, skipped: [] })).toBe("No se dio ninguna alta.");
  });
});

describe("vencimientos de documentos", () => {
  const today = "2026-11-06";
  it("dice cómo está cada vencimiento", () => {
    expect(expiryState("2026-11-05", today)).toMatchObject({ state: "vencido", label: "Venció el 05/11/2026" });
    expect(expiryState("2026-11-06", today)).toMatchObject({ state: "por-vencer", label: "Vence hoy" });
    expect(expiryState("2026-11-07", today).label).toBe("Vence mañana");
    expect(expiryState("2026-12-06", today)).toMatchObject({ state: "por-vencer", days: 30, label: "Vence en 30 días (06/12/2026)" });
    expect(expiryState("2027-06-01", today)).toMatchObject({ state: "vigente", label: "Vence el 01/06/2027" });
  });

  it("revisa la fecha que se carga", () => {
    expect(checkExpiry("", today)).toEqual({ day: null });
    expect(checkExpiry("2027-03-01", today)).toEqual({ day: "2027-03-01" });
    expect(checkExpiry("01/03/2027", today)).toHaveProperty("error");
    expect(checkExpiry("2019-01-01", today)).toHaveProperty("error");
    expect(checkExpiry("2050-01-01", today)).toHaveProperty("error");
  });

  it("los tipos de documento", () => {
    expect(isDocumentKind("CUD")).toBe(true);
    expect(isDocumentKind("cud")).toBe(false);
    expect(documentKindLabel("ESCOLARIDAD")).toBe("Escolaridad");
    expect(documentKindLabel(null)).toBe("Documento");
    expect(documentNameWithoutFile("CUD")).toBe("CUD");
  });

  it("el aviso de la campanita para un documento", () => {
    const label = "el CUD de Pérez, Juana";
    expect(expiryNotice("documento", label, "2026-12-01", today)).toEqual({
      title: "El CUD de Pérez, Juana vence este mes",
      message: "Vence el 01/12/2026 (en 25 días).",
    });
    expect(expiryNotice("documento", label, "2026-11-10", today)?.title).toBe("El CUD de Pérez, Juana vence esta semana");
    expect(expiryNotice("documento", label, "2026-11-01", today)).toEqual({
      title: "Venció el CUD de Pérez, Juana",
      message: "Venció el 01/11/2026. Cuando se renueve, cargá la fecha nueva en la ficha.",
    });
    expect(expiryNotice("documento", label, "2027-03-01", today)).toBeNull();
    // Los vehículos siguen igual.
    expect(expiryNotice("vtv", "AB123CD", "2026-11-01", today)?.title).toBe("Venció la VTV de AB123CD");
  });

  it("el asistente responde sobre los documentos por vencer", () => {
    const route = pickRoute(routingText("¿Qué CUD vencen este mes?"));
    expect(route).toBe("expiring_documents");
    expect(routeToToolCall(route, "", "").tool).toBe("documentos_por_vencer");
    expect(findTool("documentos_por_vencer")?.path).toBe("/people/vencimientos");
    expect(pickRoute(routingText("Leé el informe del expediente"))).toBe("documents");
    expect(pickRoute(routingText("¿Qué vehículos tienen la VTV vencida?"))).toBe("vehicles");
  });
});

describe("falleció o se mudó", () => {
  it("los textos", () => {
    expect(isPersonStatus("FALLECIDA")).toBe(true);
    expect(isPersonStatus("OTRA")).toBe(false);
    expect(personStatusText("FALLECIDA", "2026-11-03")).toBe("Falleció el 03/11/2026");
    expect(personStatusText("MUDADA", null)).toBe("Se mudó fuera del distrito");
    expect(withdrawReason("MUDADA", "Se fue a Córdoba")).toBe("Se mudó fuera del distrito. Se fue a Córdoba");
    expect(withdrawReason("FALLECIDA", null)).toBe("Falleció");
  });

  it("sacan la marca la conducción o quien la puso", () => {
    expect(canUndoPersonStatus({ id: "u1", role: "OPERATIVO" }, "u1")).toBe(true);
    expect(canUndoPersonStatus({ id: "u2", role: "OPERATIVO" }, "u1")).toBe(false);
    expect(canUndoPersonStatus({ id: "u2", role: "SUPERADMIN" }, "u1")).toBe(true);
    expect(canUndoPersonStatus({ id: "u1", role: "AUDITOR" }, "u1")).toBe(false);
  });
});
