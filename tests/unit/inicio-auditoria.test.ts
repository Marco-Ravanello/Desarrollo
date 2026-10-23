import { describe, expect, it } from "vitest";
import { actionsInGroup, auditLink, describeAuditAction, formatAuditDetails } from "@/lib/audit-labels";
import { barrioLabel } from "@/lib/person-display";
import { STALE_DAYS, staleCutoff, summarizeCase } from "@/lib/case-summary";

describe("Auditoría en castellano", () => {
  it("explica las acciones conocidas y las genéricas según lo que tocaron", () => {
    expect(describeAuditAction("CLOSE_CASE", "Case")).toEqual({ label: "Cerró un expediente", group: "expedientes" });
    expect(describeAuditAction("UPDATE", "Persona")).toEqual({ label: "Editó los datos de una persona", group: "personas" });
    expect(describeAuditAction("PURCHASE_ORDER_STATUS_APROBADA", "PurchaseOrder")).toEqual({ label: "Aprobó una orden de compra", group: "compras" });
    expect(describeAuditAction("RESERVATION_EN_CURSO", "VehicleReservation").label).toBe("Marcó la salida de un vehículo");
    expect(describeAuditAction("LOGIN_FAILED", "User").group).toBe("ingresos");
  });

  it("una acción desconocida se muestra legible, sin guiones bajos", () => {
    expect(describeAuditAction("ALGO_NUEVO_RARO", "Case")).toEqual({ label: "Algo nuevo raro", group: "expedientes" });
  });

  it("cada grupo trae sus acciones para filtrar en la base", () => {
    const compras = actionsInGroup("compras");
    expect(compras.prefixes).toEqual(["PURCHASE_ORDER_STATUS_"]);
    expect(compras.entities).toContain("PurchaseOrder");
    expect(actionsInGroup("emergencia").actions).toContain("PADRON_ALTA_EMERGENCIA");
    expect(actionsInGroup("ingresos").actions).toEqual(["LOGIN", "LOGIN_FAILED"]);
  });

  it("el detalle en JSON se muestra como texto y sin identificadores internos", () => {
    expect(formatAuditDetails('{"dni":"30111222","caseId":"ckabc","relationship":"Hija"}')).toBe("DNI: 30111222 · Vínculo: Hija");
    expect(formatAuditDetails("{roto")).toBe("{roto");
    expect(formatAuditDetails(null)).toBe("");
  });

  it("enlaza a la persona por DNI, al expediente o a nada", () => {
    expect(auditLink({ action: "UPDATE", entity: "Persona", entityId: "30111222" })).toBe("/people/30111222");
    expect(auditLink({ action: "ADD_FAMILY_MEMBER", entity: "Family", entityId: "f1", details: '{"memberDni":"40111222"}' })).toBe("/people/40111222");
    expect(auditLink({ action: "CLOSE_CASE", entity: "Case", entityId: "c1" })).toBe("/cases/c1");
    expect(auditLink({ action: "DELETE_PROVIDER", entity: "Provider", entityId: "p1" })).toBeNull();
    expect(auditLink({ action: "LOGIN", entity: "User", entityId: "u1" })).toBeNull();
  });
});

describe("barrio sin repetir la palabra", () => {
  it("agrega 'Barrio' solo cuando falta", () => {
    expect(barrioLabel("Loma Hermosa")).toBe("Barrio Loma Hermosa");
    expect(barrioLabel("Barrio Loma Hermosa")).toBe("Barrio Loma Hermosa");
    expect(barrioLabel("Bº Loma Hermosa")).toBe("Bº Loma Hermosa");
    expect(barrioLabel("  ")).toBe("");
  });
});

describe("desde cuándo un expediente está quieto", () => {
  it("es medianoche argentina de hace STALE_DAYS - 1 días, igual que el resumen del expediente", () => {
    const now = new Date("2026-10-23T02:00:00Z"); // 22/10 a las 23 h en Argentina
    const cutoff = staleCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-09-23T03:00:00.000Z");
    const justBefore = new Date(cutoff.getTime() - 1);
    const atCutoff = cutoff;
    expect(summarizeCase({ status: "ABIERTO", createdAt: justBefore, lastInterventionAt: null, now }).quietDays).toBe(STALE_DAYS);
    expect(summarizeCase({ status: "ABIERTO", createdAt: atCutoff, lastInterventionAt: null, now }).quietDays).toBe(STALE_DAYS - 1);
  });
});
