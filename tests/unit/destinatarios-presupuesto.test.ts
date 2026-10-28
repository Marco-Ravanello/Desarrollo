import { describe, expect, it } from "vitest";
import {
  EMPTY_REQUIREMENTS, ageText, describeRequirements, hasCheckableRequirements, parseRequirementsInput, requirementsFromRow, requirementsSummary,
} from "@/lib/program-requirements";
import { canViewProgramCandidates } from "@/lib/program-ownership";
import { budgetState } from "@/lib/budget";
import { canEditHR } from "@/lib/hr-labels";
import { TASK_MANAGER_ROLES } from "@/lib/tasks";

const JM = "prog_jardines_municipales" as const;

describe("requisitos de un programa", () => {
  it("revisa la edad", () => {
    expect(parseRequirementsInput(JM, { edadMin: "45", edadMax: "4" })).toEqual({ ok: false, error: "La edad mínima no puede ser mayor que la máxima." });
    expect(parseRequirementsInput(JM, { edadMin: "-1" }).ok).toBe(false);
    expect(parseRequirementsInput(JM, { edadMax: "2,5" }).ok).toBe(false);
    expect(parseRequirementsInput(JM, { edadMax: "200" }).ok).toBe(false);
    const ok = parseRequirementsInput(JM, { edadMin: "", edadMax: " 4 " });
    expect(ok).toMatchObject({ ok: true, data: { edadMin: null, edadMax: 4 } });
  });

  it("deja solo barrios, etiquetas y programas de la lista, en su orden, y nunca el mismo programa", () => {
    const r = parseRequirementsInput(JM, {
      barrios: ["Villa Bosch", "Inventado", "Caseros"],
      etiquetas: ["NINEZ", "OTRA", "DISCAPACIDAD"],
      enProgramas: ["prog_tarjeta_alimentar", JM, "prog_inventado"],
      sinProgramas: ["prog_centro_de_familia"],
      nota: "  Ingresos bajos  ",
    });
    expect(r).toEqual({
      ok: true,
      data: {
        edadMin: null, edadMax: null,
        barrios: ["Caseros", "Villa Bosch"],
        etiquetas: ["DISCAPACIDAD", "NINEZ"],
        enProgramas: ["prog_tarjeta_alimentar"],
        sinProgramas: ["prog_centro_de_familia"],
        nota: "Ingresos bajos",
      },
    });
  });

  it("un programa no puede ser requisito y exclusión a la vez", () => {
    const r = parseRequirementsInput(JM, { enProgramas: ["prog_tarjeta_alimentar"], sinProgramas: ["prog_tarjeta_alimentar"] });
    expect(r).toEqual({ ok: false, error: "Tarjeta Alimentar no puede ser requisito y exclusión a la vez." });
  });

  it("la nota sola no alcanza para armar la lista", () => {
    expect(hasCheckableRequirements(EMPTY_REQUIREMENTS)).toBe(false);
    expect(hasCheckableRequirements({ ...EMPTY_REQUIREMENTS, nota: "algo" })).toBe(false);
    expect(hasCheckableRequirements({ ...EMPTY_REQUIREMENTS, edadMax: 4 })).toBe(true);
    expect(hasCheckableRequirements({ ...EMPTY_REQUIREMENTS, sinProgramas: ["prog_tarjeta_alimentar"] })).toBe(true);
  });

  it("se leen como frases", () => {
    expect(ageText(1, 4)).toBe("De 1 a 4 años");
    expect(ageText(60, null)).toBe("Desde 60 años");
    expect(ageText(null, 1)).toBe("Hasta 1 año");
    expect(ageText(18, 18)).toBe("18 años");
    const r = {
      edadMin: 1, edadMax: 4, barrios: ["Caseros", "Churruca", "Villa Bosch"] as any, etiquetas: ["NINEZ"] as any,
      enProgramas: ["prog_tarjeta_alimentar"] as any, sinProgramas: ["prog_centro_de_familia", "prog_tarjeta_mas_familia"] as any, nota: "Ingresos bajos",
    };
    expect(describeRequirements(r)).toEqual([
      "De 1 a 4 años",
      "Vive en Caseros, Churruca o Villa Bosch",
      "Tiene un expediente abierto de niñez y adolescencia",
      "Está en Tarjeta Alimentar",
      "No está en Centro de Familia ni Tarjeta Más Familia",
    ]);
    expect(requirementsSummary(r)).toMatch(/Otros: Ingresos bajos\.$/);
    expect(requirementsSummary(EMPTY_REQUIREMENTS)).toBe("Sin requisitos.");
  });

  it("lo guardado se limpia si algo de la lista cambió", () => {
    const row = { edadMin: 2, edadMax: null, barrios: ["Caseros", "Ya no existe"], etiquetas: [], enProgramas: [], sinProgramas: ["prog_viejo"], nota: null };
    expect(requirementsFromRow(JM, row)).toMatchObject({ edadMin: 2, barrios: ["Caseros"], sinProgramas: [] });
    expect(requirementsFromRow(JM, null)).toEqual(EMPTY_REQUIREMENTS);
  });

  it("la lista la ve quien da altas en el programa y la conducción", () => {
    expect(canViewProgramCandidates({ role: "DIRECCION_GENERAL" }, "area-1")).toBe(true);
    expect(canViewProgramCandidates({ role: "OPERATIVO", areaId: "area-1" }, "area-1")).toBe(true);
    expect(canViewProgramCandidates({ role: "OPERATIVO", areaId: "area-2" }, "area-1")).toBe(false);
    expect(canViewProgramCandidates({ role: "AUDITOR" }, null)).toBe(false);
    expect(canViewProgramCandidates({ role: "RELEVADOR_EMERGENCIA" }, null)).toBe(false);
  });
});

describe("presupuesto de un área", () => {
  it("sin presupuesto cargado no hay saldo negativo: falta cargarlo", () => {
    expect(budgetState(0, 200000)).toBe("FALTA_CARGAR");
    expect(budgetState(0, 0)).toBe("SIN_PRESUPUESTO");
    expect(budgetState(100, 150)).toBe("EXCEDIDO");
    expect(budgetState(100, 100)).toBe("OK");
  });
});

describe("quién edita personal y tareas", () => {
  it("solo Superadmin y Administración General marcan que alguien volvió", () => {
    expect(canEditHR("SUPERADMIN")).toBe(true);
    expect(canEditHR("ADMIN_GENERAL")).toBe(true);
    expect(canEditHR("DIRECCION_GENERAL")).toBe(false);
    expect(canEditHR(null)).toBe(false);
  });

  it("la conducción completa tareas de otras personas", () => {
    expect(TASK_MANAGER_ROLES).toEqual(["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"]);
  });
});
