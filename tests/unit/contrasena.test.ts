import { describe, expect, it } from "vitest";
import { newPasswordProblem } from "@/lib/password-rules";
import { authConfig } from "@/auth.config";

describe("reglas de la contraseña nueva", () => {
  it("pide al menos 8 caracteres, letras y números", () => {
    expect(newPasswordProblem("abc12")).toMatch(/al menos 8/);
    expect(newPasswordProblem("solamenteletras")).toMatch(/letras y números/);
    expect(newPasswordProblem("1234567890")).toMatch(/letras y números/);
    expect(newPasswordProblem("Arbolito2026")).toBeNull();
  });

  it("no acepta la misma contraseña ni una que contenga el usuario", () => {
    expect(newPasswordProblem("Arbolito2026", { current: "Arbolito2026" })).toMatch(/distinta/);
    expect(newPasswordProblem("jperez2026x", { email: "jperez@tresdefebrero.gob.ar" })).toMatch(/usuario/);
  });
});

describe("cambio obligatorio al ingresar", () => {
  const authorized = (path: string, user: Record<string, unknown> | null) =>
    authConfig.callbacks.authorized({ auth: user ? ({ user } as any) : null, request: { nextUrl: new URL(`http://localhost${path}`) } as any });

  it("con la contraseña que puso un administrador, cualquier pantalla lleva a cambiarla", () => {
    const res = authorized("/dashboard", { role: "OPERATIVO", mustChangePassword: true }) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get("location")).toBe("http://localhost/cambiar-clave");
    expect(authorized("/cambiar-clave", { role: "OPERATIVO", mustChangePassword: true })).toBe(true);
  });

  it("una vez cambiada, se navega normalmente", () => {
    expect(authorized("/dashboard", { role: "OPERATIVO", mustChangePassword: false })).toBe(true);
    expect(authorized("/cambiar-clave", { role: "RELEVADOR_EMERGENCIA" })).toBe(true);
  });
});
