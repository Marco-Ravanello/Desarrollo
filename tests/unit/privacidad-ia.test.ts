import { describe, expect, it } from "vitest";
import { sanitizeText } from "@/lib/pii-sanitizer";

// Lo que se manda a Gemini pasa antes por este filtro.
describe("datos personales antes de enviar al asistente", () => {
  it("oculta DNI, CUIT, teléfonos y nombres conocidos, y los recupera en la respuesta", () => {
    const texto = "Juana Pérez, DNI 30123456, CUIT 27-30123456-4, tel 11 45678901";
    const { sanitizedText, rehydrate } = sanitizeText(texto, { names: ["Juana Pérez"] });

    expect(sanitizedText).not.toContain("30123456");
    expect(sanitizedText).not.toContain("45678901");
    expect(sanitizedText).not.toContain("Juana Pérez");
    expect(sanitizedText).toContain("[CIUDADANO_1]");
    expect(rehydrate(sanitizedText)).toBe(texto);
  });
});
