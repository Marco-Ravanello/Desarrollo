import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizeUsername, suggestUsername, usernameProblem } from "@/lib/username";

describe("nombre de usuario", () => {
  it("se guarda en minúsculas y sin espacios alrededor", () => {
    expect(normalizeUsername("  Maria.Perez ")).toBe("maria.perez");
  });

  it("acepta letras sin tilde, números, punto y guiones", () => {
    expect(usernameProblem("maria.perez")).toBeNull();
    expect(usernameProblem("jperez_2")).toBeNull();
    expect(usernameProblem("ab")).not.toBeNull();
    expect(usernameProblem("maría")).not.toBeNull();
    expect(usernameProblem("maria perez")).not.toBeNull();
    expect(usernameProblem(".maria")).not.toBeNull();
    expect(usernameProblem("")).not.toBeNull();
  });

  it("sugiere nombre.apellido a partir del nombre completo", () => {
    expect(suggestUsername("María José Pérez")).toBe("maria.perez");
    expect(suggestUsername("Ñandú")).toBe("nandu");
    expect(suggestUsername("  ")).toBe("");
  });

  it("el correo es opcional, pero si se escribe tiene que parecer un correo", () => {
    expect(normalizeEmail("")).toEqual({ ok: true, email: null });
    expect(normalizeEmail(" Ana@Muni.gob.ar ")).toEqual({ ok: true, email: "ana@muni.gob.ar" });
    expect(normalizeEmail("ana").ok).toBe(false);
  });
});
