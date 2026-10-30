import { describe, expect, it } from "vitest";
import { NAV_GROUPS, isNavItemActive, sectionToneForPath } from "@/lib/secciones";
import {
  CASE_STATUS_TONE, ORDER_STATUS_TONE, PRIORITY_TONE, STATUS_TONE_CLASS, toneOf,
} from "@/lib/status-tones";
import { getCaseStatusConfig, getOrderStatusConfig } from "@/lib/status-styles";

describe("color de cada sección del menú", () => {
  it("cada pantalla toma el color de su grupo", () => {
    expect(sectionToneForPath("/cases/abc")).toBe("blue");
    expect(sectionToneForPath("/admin/calendar")).toBe("violet");
    expect(sectionToneForPath("/admin/purchase-orders/123")).toBe("emerald");
    expect(sectionToneForPath("/admin/vehicles/fuel")).toBe("orange");
    expect(sectionToneForPath("/admin/users")).toBe("slate");
  });

  it("las áreas conservan su propio color y el control del gasto va con Convenios", () => {
    expect(sectionToneForPath("/areas/violence")).toBe("rose");
    expect(sectionToneForPath("/areas/ninez")).toBe("amber");
    expect(sectionToneForPath("/convenios/xyz")).toBe("cyan");
  });

  it("una pantalla fuera del menú queda azul", () => {
    expect(sectionToneForPath("/cambiar-clave")).toBe("blue");
  });

  it("Inicio solo se marca en Inicio, y no se confunden rutas que empiezan igual", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/cases", "/dashboard")).toBe(false);
    expect(isNavItemActive("/people/programas", "/people")).toBe(true);
    expect(isNavItemActive("/peoplex", "/people")).toBe(false);
  });

  it("no hay dos entradas del menú con la misma dirección", () => {
    const urls = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.url));
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("insignias de estado", () => {
  it("cada color quiere decir lo mismo en expedientes, prioridades y órdenes", () => {
    expect(CASE_STATUS_TONE.CERRADO).toBe("slate");
    expect(ORDER_STATUS_TONE.CANCELADA).toBe("slate");
    expect(PRIORITY_TONE.URGENTE).toBe("red");
    expect(ORDER_STATUS_TONE.RECHAZADA).toBe("red");
    expect(CASE_STATUS_TONE.DERIVADO).toBe("violet");
  });

  it("un estado desconocido queda gris en vez de romperse", () => {
    expect(toneOf(CASE_STATUS_TONE, "OTRO")).toBe("slate");
    expect(toneOf(CASE_STATUS_TONE, null)).toBe("slate");
    expect(getCaseStatusConfig("OTRO")).toMatchObject({ label: "OTRO", tone: "slate" });
  });

  it("los nombres salen de las listas de la app", () => {
    expect(getCaseStatusConfig("EN_PROCESO")).toMatchObject({ label: "En proceso", tone: "amber", badgeClass: STATUS_TONE_CLASS.amber });
    expect(getOrderStatusConfig("PENDIENTE_APROBACION").label).toBe("Pendiente de aprobación");
  });
});
