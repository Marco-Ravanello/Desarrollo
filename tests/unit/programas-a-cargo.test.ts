import { describe, expect, it } from "vitest";
import { canAssignProgramArea, canManageProgram } from "@/lib/program-ownership";
import { PADRON_PROGRAMS, programFromSlug, programHref, programSlug } from "@/lib/padron-programs";

describe("quién da altas y bajas en cada programa", () => {
  it("la conducción, en todos; el resto, en los de su área o en los que no tienen área", () => {
    for (const role of ["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"]) {
      expect(canManageProgram({ role, areaId: null }, "area-a")).toBe(true);
      expect(canAssignProgramArea(role)).toBe(true);
    }
    for (const role of ["DIRECTOR_AREA", "OPERATIVO", "VIOLENCIA_GENERO"]) {
      expect(canManageProgram({ role, areaId: "area-a" }, "area-a")).toBe(true);
      expect(canManageProgram({ role, areaId: "area-b" }, "area-a")).toBe(false);
      expect(canManageProgram({ role, areaId: null }, "area-a")).toBe(false);
      expect(canManageProgram({ role, areaId: "area-b" }, null)).toBe(true);
      expect(canAssignProgramArea(role)).toBe(false);
    }
  });

  it("Auditoría y el relevador no dan altas ni bajas en ningún programa", () => {
    for (const role of ["AUDITOR", "RELEVADOR_EMERGENCIA"]) {
      expect(canManageProgram({ role, areaId: "area-a" }, "area-a")).toBe(false);
      expect(canManageProgram({ role, areaId: "area-a" }, null)).toBe(false);
      expect(canAssignProgramArea(role)).toBe(false);
    }
    expect(canManageProgram({ role: null }, null)).toBe(false);
  });
});

describe("dirección de la página de cada programa", () => {
  it("cada programa tiene su dirección y se encuentra con ella", () => {
    for (const p of PADRON_PROGRAMS) {
      expect(programFromSlug(programSlug(p.column))?.column).toBe(p.column);
      expect(programHref(p.column)).toBe(`/people/programas/${programSlug(p.column)}`);
    }
    expect(programSlug("prog_tarjeta_alimentar")).toBe("tarjeta_alimentar");
    expect(programFromSlug("inventado")).toBeNull();
    expect(programFromSlug("")).toBeNull();
    expect(programFromSlug(undefined)).toBeNull();
  });
});
