import { describe, expect, it } from "vitest";
import {
  PADRON_PROGRAMS, addProgramToList, programColumnFor, removeProgramFromList, splitProgramList,
} from "@/lib/padron-programs";

describe("columna de cada programa", () => {
  it("cada nombre de la lista lleva a su propia columna", () => {
    for (const p of PADRON_PROGRAMS) expect(programColumnFor(p.label)).toBe(p.column);
  });

  it("reconoce el nombre escrito de otra forma y descarta los que no son de la lista", () => {
    expect(programColumnFor("CURSO DE ARBITROS (DEPORTES)")).toBe("prog_curso_de_arbitros_deportes");
    expect(programColumnFor("  tarjeta alimentar ")).toBe("prog_tarjeta_alimentar");
    expect(programColumnFor("Garrafa Social")).toBeNull();
    expect(programColumnFor("")).toBeNull();
  });
});

describe("lista de programas activos", () => {
  it("suma sin repetir y saca con cualquier forma de escribirlo", () => {
    expect(addProgramToList(null, "prog_tarjeta_alimentar")).toBe("Tarjeta Alimentar");
    expect(addProgramToList("Envión | TARJETA ALIMENTAR", "prog_tarjeta_alimentar")).toBe("Envión | TARJETA ALIMENTAR");
    expect(addProgramToList("Envión", "prog_centro_de_familia")).toBe("Envión | Centro de Familia");
    expect(removeProgramFromList("Envión | TARJETA ALIMENTAR | Garrafa Social", "prog_tarjeta_alimentar")).toBe("Envión | Garrafa Social");
    expect(removeProgramFromList("Tarjeta Alimentar", "prog_tarjeta_alimentar")).toBeNull();
    expect(splitProgramList(" A |  | B ")).toEqual(["A", "B"]);
  });
});
