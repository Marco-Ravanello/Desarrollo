import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { ROLE_INFO, ROLE_ORDER, roleLabel } from "@/lib/roles";

describe("nombres de los roles", () => {
  it("todos los roles tienen nombre y descripción en castellano, y aparecen una vez en el orden", () => {
    for (const r of Object.values(Role)) {
      expect(ROLE_INFO[r].label).toBeTruthy();
      expect(ROLE_INFO[r].label).not.toMatch(/_/);
      expect(ROLE_INFO[r].description.length).toBeGreaterThan(10);
    }
    expect([...ROLE_ORDER].sort()).toEqual([...Object.values(Role)].sort());
  });

  it("muestra el nombre común en lugar de la clave técnica", () => {
    expect(roleLabel("DIRECCION_GENERAL")).toBe("Dirección General");
    expect(roleLabel("RELEVADOR_EMERGENCIA")).toBe("Relevamiento de emergencia");
    expect(roleLabel(null)).toBe("Sin rol");
    expect(roleLabel("OTRA_COSA")).toBe("Sin rol");
  });
});
