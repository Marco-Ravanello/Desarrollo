import { describe, expect, it } from "vitest";
import {
  canAssignReferente, canDeleteRecorrida, canManageRecorrida, canPlanRecorridas, criteriaToParams, parseFechaRecorrida,
  parseRecorridaCriteria, sortByStreet, splitStreet, visitaResultadoLabel,
} from "@/lib/recorridas";

describe("calle y altura de una dirección escrita a mano", () => {
  it("separa la calle de la altura sin tildes ni signos", () => {
    expect(splitStreet("Av. Pte. Perón 2345 dpto 3")).toEqual({ calle: "av pte peron", altura: 2345 });
    expect(splitStreet("Calle Inventada N° 22")).toEqual({ calle: "calle inventada", altura: 22 });
    expect(splitStreet("25 de Mayo 300")).toEqual({ calle: "25 de mayo", altura: 300 });
    expect(splitStreet("Pasaje Sin Número")).toEqual({ calle: "pasaje sin numero", altura: null });
    expect(splitStreet("  ")).toEqual({ calle: "", altura: null });
    expect(splitStreet(null)).toEqual({ calle: "", altura: null });
  });

  it("ordena para caminar: por calle, una vereda subiendo y la otra bajando, sin dirección al final", () => {
    const rows = [
      { id: "a", direccion: "Mitre 105" },
      { id: "b", direccion: null },
      { id: "c", direccion: "Alsina 300" },
      { id: "d", direccion: "Mitre 102" },
      { id: "e", direccion: "Mitre 110" },
      { id: "f", direccion: "Mitre 109" },
      { id: "g", direccion: "Mitre s/n" },
      { id: "h", direccion: "Álsina 120" },
    ];
    expect(sortByStreet(rows).map((r) => r.id)).toEqual(["h", "c", "d", "e", "f", "a", "g", "b"]);
  });
});

describe("criterios de la lista de una recorrida", () => {
  it("lee los motivos de la dirección y descarta lo que no corresponde", () => {
    expect(parseRecorridaCriteria({ motivo: ["quietos", "urgentes", "inventado", "quietos"] })).toEqual({
      motivos: ["quietos", "urgentes"],
      programa: null,
      calle: null,
      sinVisitados: true,
    });
    // El programa cuenta como motivo solo si es una columna conocida.
    expect(parseRecorridaCriteria({ motivo: "programa", programa: "prog_tarjeta_alimentar", calle: "  Perón  ", visitados: "1" })).toEqual({
      motivos: ["programa"],
      programa: "prog_tarjeta_alimentar",
      calle: "Perón",
      sinVisitados: false,
    });
    expect(parseRecorridaCriteria({ motivo: "programa", programa: "prog_inventado" }).motivos).toEqual([]);
  });

  it("vuelve a armar la dirección con los mismos criterios", () => {
    const c = parseRecorridaCriteria({ motivo: ["tormenta", "sinTelefono"], programa: "prog_centro_de_familia", calle: "Mitre", visitados: "1" });
    expect(criteriaToParams(c).toString()).toBe("motivo=tormenta&motivo=sinTelefono&programa=prog_centro_de_familia&calle=Mitre&visitados=1");
    expect(parseRecorridaCriteria(Object.fromEntries([["motivo", ["tormenta", "sinTelefono"]], ...[...criteriaToParams(c)].filter(([k]) => k !== "motivo")]))).toEqual(c);
  });

  it("la fecha es un día de calendario a la medianoche UTC", () => {
    expect(parseFechaRecorrida("2026-10-30")?.toISOString()).toBe("2026-10-30T00:00:00.000Z");
    expect(parseFechaRecorrida("2026-02-30")).toBeNull();
    expect(parseFechaRecorrida("30/10/2026")).toBeNull();
    expect(parseFechaRecorrida(undefined)).toBeNull();
  });

  it("nombra el resultado de cada visita", () => {
    expect(visitaResultadoLabel("NO_ESTABA")).toBe("No estaba");
    expect(visitaResultadoLabel("CUALQUIERA")).toBe("Otro");
  });
});

describe("quién puede hacer qué con las recorridas", () => {
  const rec = { createdById: "u1", equipoIds: ["u1", "u2"] };
  it("arman recorridas quienes cargan datos sociales", () => {
    expect(canPlanRecorridas("OPERATIVO")).toBe(true);
    expect(canPlanRecorridas("AUDITOR")).toBe(false);
    expect(canPlanRecorridas("RELEVADOR_EMERGENCIA")).toBe(false);
  });
  it("la cambia quien la armó, quien sale o la conducción; la borra quien la armó o la conducción", () => {
    expect(canManageRecorrida({ id: "u2", role: "OPERATIVO" }, rec)).toBe(true);
    expect(canManageRecorrida({ id: "u3", role: "OPERATIVO" }, rec)).toBe(false);
    expect(canManageRecorrida({ id: "u3", role: "DIRECCION_GENERAL" }, rec)).toBe(true);
    expect(canManageRecorrida({ id: "u2", role: "AUDITOR" }, rec)).toBe(false);
    expect(canDeleteRecorrida({ id: "u2", role: "OPERATIVO" }, rec)).toBe(false);
    expect(canDeleteRecorrida({ id: "u1", role: "OPERATIVO" }, rec)).toBe(true);
    expect(canDeleteRecorrida({ id: "u9", role: "SUPERADMIN" }, rec)).toBe(true);
  });
  it("el referente lo elige la conducción", () => {
    expect(canAssignReferente("ADMIN_GENERAL")).toBe(true);
    expect(canAssignReferente("DIRECTOR_AREA")).toBe(false);
  });
});
