import { describe, expect, it } from "vitest";
import { columnasDelCruce, condicionDelCruce, fraseDelCruce, nombreDelModo, parseModoCruce, programasDeLaFila } from "@/lib/cruces";

describe("cruces de programas", () => {
  it("toma solo programas de la lista fija, en orden y sin repetir", () => {
    expect(columnasDelCruce(["Tarjeta Alimentar", "Jardines Municipales", "Tarjeta Alimentar", "x; DROP TABLE"])).toEqual([
      "prog_tarjeta_alimentar",
      "prog_jardines_municipales",
    ]);
    expect(columnasDelCruce(["prog_centro_de_familia"])).toEqual(["prog_centro_de_familia"]);
  });

  it("arma la condición de cada tipo de cruce", () => {
    const cols = ["prog_a", "prog_b", "prog_c"];
    expect(condicionDelCruce(cols, "interseccion")).toBe('("prog_a" = 1 AND "prog_b" = 1 AND "prog_c" = 1)');
    expect(condicionDelCruce(cols, "union")).toBe('("prog_a" = 1 OR "prog_b" = 1 OR "prog_c" = 1)');
    expect(condicionDelCruce(cols, "diferencia")).toBe('("prog_a" = 1 AND NOT (COALESCE("prog_b", 0) = 1 OR COALESCE("prog_c", 0) = 1))');
    expect(condicionDelCruce(["prog_a"], "diferencia")).toBe('("prog_a" = 1)');
    expect(condicionDelCruce([], "union")).toBe("1=1");
  });

  it("explica el resultado en una frase", () => {
    expect(fraseDelCruce(["Tarjeta Alimentar", "Jardines Municipales"], "interseccion")).toBe("en Tarjeta Alimentar y Jardines Municipales a la vez");
    expect(fraseDelCruce(["A", "B", "C"], "union")).toBe("en A, B o C");
    expect(fraseDelCruce(["A", "B"], "diferencia")).toBe("en A y no en B");
    expect(fraseDelCruce(["A", "B", "C"], "diferencia")).toBe("en A y en ninguno de estos: B y C");
    expect(fraseDelCruce(["A"], "interseccion")).toBe("en A");
  });

  it("nombres de los modos y valores raros", () => {
    expect(parseModoCruce("UNION")).toBe("union");
    expect(parseModoCruce("cualquier cosa")).toBe("interseccion");
    expect(nombreDelModo("diferencia")).toBe("Exclusión");
  });

  it("los programas de cada fila salen de las columnas, con su nombre", () => {
    expect(programasDeLaFila({ prog_tarjeta_alimentar: 1, prog_jardines_municipales: 0, prog_centro_de_familia: 1 })).toEqual([
      "Centro de Familia",
      "Tarjeta Alimentar",
    ]);
    expect(programasDeLaFila({})).toEqual([]);
  });
});
