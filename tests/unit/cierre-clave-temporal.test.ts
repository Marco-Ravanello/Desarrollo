import { describe, expect, it } from "vitest";
import { canCloseOrReopenCase, caseReasonProblem, CASE_REASON_MAX, reasonFromDetails } from "@/lib/case-closing";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { newPasswordProblem } from "@/lib/password-rules";
import { canCreateUsersAndResetPasswords } from "@/lib/permissions";

describe("cerrar y reabrir expedientes", () => {
  it("pide un motivo y no acepta uno vacío ni demasiado largo", () => {
    expect(caseReasonProblem("", "cerrar")).toMatch(/motivo para cerrar/);
    expect(caseReasonProblem("   ", "reabrir")).toMatch(/motivo para reabrir/);
    expect(caseReasonProblem("x".repeat(CASE_REASON_MAX + 1), "cerrar")).toMatch(/hasta/);
    expect(caseReasonProblem("Se resolvió", "cerrar")).toBeNull();
  });

  it("lee el motivo guardado y deja sin motivo los cierres viejos", () => {
    expect(reasonFromDetails("Motivo: Se resolvió\ncon la familia")).toBe("Se resolvió\ncon la familia");
    expect(reasonFromDetails("Caso cerrado: Expediente viejo")).toBeNull();
    expect(reasonFromDetails(null)).toBeNull();
  });

  it("no cierran Auditoría ni el relevador; Violencia de Género solo quien puede verlo", () => {
    expect(canCloseOrReopenCase({ role: "OPERATIVO" }, "Niñez")).toBe(true);
    expect(canCloseOrReopenCase({ role: "AUDITOR" }, "Niñez")).toBe(false);
    expect(canCloseOrReopenCase({ role: "RELEVADOR_EMERGENCIA" }, "Niñez")).toBe(false);
    expect(canCloseOrReopenCase({ role: "OPERATIVO" }, "Violencia de Género")).toBe(false);
    expect(canCloseOrReopenCase({ role: "VIOLENCIA_GENERO" }, "Violencia de Género")).toBe(true);
  });
});

describe("clave temporal", () => {
  it("es fácil de dictar y cumple las reglas de contraseña", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword();
      expect(p).toMatch(/^[a-km-np-z]{4}-[2-9]{4}-[a-km-np-z]{4}$/);
      expect(newPasswordProblem(p)).toBeNull();
    }
  });

  it("sale distinta cada vez", () => {
    const set = new Set(Array.from({ length: 50 }, generateTemporaryPassword));
    expect(set.size).toBe(50);
  });

  it("crear usuarios y restablecer contraseñas es solo del Superadmin", () => {
    expect(canCreateUsersAndResetPasswords("SUPERADMIN")).toBe(true);
    for (const r of ["ADMIN_GENERAL", "DIRECCION_GENERAL", "DIRECTOR_AREA", "OPERATIVO", "AUDITOR", null]) {
      expect(canCreateUsersAndResetPasswords(r)).toBe(false);
    }
  });
});
