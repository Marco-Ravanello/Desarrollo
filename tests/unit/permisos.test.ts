import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import {
  AI_ASSISTANT_ROLES,
  PERMISSIONS,
  canAccessPath,
  canEditSocialRecords,
  canManageEmergencyStock,
  canUseAiAssistant,
  hasPermission,
  homePathFor,
} from "@/lib/permissions";

const ROLES: Role[] = [
  "SUPERADMIN",
  "DIRECCION_GENERAL",
  "ADMIN_GENERAL",
  "DIRECTOR_AREA",
  "OPERATIVO",
  "AUDITOR",
  "VIOLENCIA_GENERO",
  "RELEVADOR_EMERGENCIA",
];

/** Qué roles pueden abrir cada pantalla. */
const PANTALLAS: Record<string, Role[]> = {
  "/admin/assistant": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA"],
  "/admin/settings": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL"],
  "/admin/users": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL"],
  "/admin/audit": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "AUDITOR"],
  "/admin/hr": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL"],
  "/admin/purchase-orders": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "AUDITOR"],
  "/admin/purchase-orders/new": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA"],
  "/admin/budget": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "AUDITOR"],
  "/admin/reports": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "AUDITOR"],
  "/admin/vehicles/new": ["SUPERADMIN", "ADMIN_GENERAL"],
  "/areas/violence": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "VIOLENCIA_GENERO"],
  "/people/new": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "OPERATIVO", "VIOLENCIA_GENERO"],
  "/cases/new": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "OPERATIVO", "VIOLENCIA_GENERO"],
  "/dashboard": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "OPERATIVO", "AUDITOR", "VIOLENCIA_GENERO"],
  "/cases": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "OPERATIVO", "AUDITOR", "VIOLENCIA_GENERO"],
  "/admin/emergency": ROLES,
  "/maps": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "OPERATIVO", "AUDITOR", "VIOLENCIA_GENERO"],
  "/maps/ubicar": ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL"],
};

describe("acceso a pantallas por rol", () => {
  for (const [path, allowed] of Object.entries(PANTALLAS)) {
    for (const role of ROLES) {
      const expected = allowed.includes(role);
      it(`${role} ${expected ? "puede" : "no puede"} abrir ${path}`, () => {
        expect(canAccessPath(role, path)).toBe(expected);
      });
    }
  }

  it("las subpantallas heredan la regla (también si se escribe la dirección a mano)", () => {
    expect(canAccessPath("OPERATIVO", "/admin/assistant/historial")).toBe(false);
    expect(canAccessPath("AUDITOR", "/areas/violence/caso-1")).toBe(false);
    expect(canAccessPath("RELEVADOR_EMERGENCIA", "/admin/emergency/ficha")).toBe(true);
  });

  it("sin sesión no se abre ninguna pantalla restringida", () => {
    expect(canAccessPath(null, "/admin/settings")).toBe(false);
    expect(canAccessPath(undefined, "/admin/assistant")).toBe(false);
  });
});

describe("Asistente de IA", () => {
  it("solo lo usan Director de Área, Dirección General, Admin General y Superadmin", () => {
    expect([...AI_ASSISTANT_ROLES].sort()).toEqual(["ADMIN_GENERAL", "DIRECCION_GENERAL", "DIRECTOR_AREA", "SUPERADMIN"]);
    for (const role of ROLES) {
      expect(canUseAiAssistant(role)).toBe(AI_ASSISTANT_ROLES.includes(role));
    }
    expect(canUseAiAssistant(null)).toBe(false);
  });
});

describe("permisos especiales", () => {
  it("solo Violencia de Género y la conducción ven casos sensibles", () => {
    const conPermiso = ROLES.filter((r) => hasPermission(r, PERMISSIONS.VIEW_SENSITIVE_CASES));
    expect(conPermiso.sort()).toEqual(["ADMIN_GENERAL", "DIRECCION_GENERAL", "SUPERADMIN", "VIOLENCIA_GENERO"]);
  });

  it("Auditoría consulta pero no carga datos sociales", () => {
    expect(canEditSocialRecords("AUDITOR")).toBe(false);
    expect(canEditSocialRecords("OPERATIVO")).toBe(true);
    expect(canEditSocialRecords(null)).toBe(false);
  });

  it("el stock de contingencia no lo mueven ni el relevador ni Auditoría", () => {
    expect(canManageEmergencyStock("RELEVADOR_EMERGENCIA")).toBe(false);
    expect(canManageEmergencyStock("AUDITOR")).toBe(false);
    expect(canManageEmergencyStock("OPERATIVO")).toBe(true);
  });

  it("el relevador entra directo a sus fichas y el resto al inicio", () => {
    expect(homePathFor("RELEVADOR_EMERGENCIA")).toBe("/admin/emergency");
    expect(homePathFor("OPERATIVO")).toBe("/dashboard");
  });
});
