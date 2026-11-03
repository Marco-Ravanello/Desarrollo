import { describe, expect, it } from "vitest";
import { fraseDelResumen, partesDelResumen, separadorAntes } from "@/lib/resumen-del-dia";
import { tituloConAvisos } from "@/lib/titulo-avisos";
import { bienvenidaPara } from "@/lib/bienvenida";
import { canAccessPath } from "@/lib/permissions";
import { ROLE_ORDER } from "@/lib/roles";

describe("frase de hoy bajo el saludo", () => {
  it("nombra solo lo que tiene algo, con 'y' antes de la última parte", () => {
    expect(fraseDelResumen({ tareas: 2, vencidas: 0, quietos: 3, derivaciones: 1 })).toBe(
      "Para hoy tenés 2 tareas, 3 expedientes sin movimiento y 1 derivación por responder."
    );
    expect(fraseDelResumen({ tareas: 0, vencidas: 0, quietos: 1, derivaciones: 2 })).toBe(
      "Para hoy tenés 1 expediente sin movimiento y 2 derivaciones por responder."
    );
    expect(partesDelResumen({ tareas: 0, vencidas: 0, quietos: 0, derivaciones: 4 }).map((p) => p.clave)).toEqual(["derivaciones"]);
  });

  it("dice cuántas tareas vencieron", () => {
    expect(fraseDelResumen({ tareas: 3, vencidas: 1, quietos: 0, derivaciones: 0 })).toBe("Para hoy tenés 3 tareas (1 vencida).");
    expect(fraseDelResumen({ tareas: 2, vencidas: 2, quietos: 0, derivaciones: 0 })).toBe("Para hoy tenés 2 tareas vencidas.");
    expect(fraseDelResumen({ tareas: 1, vencidas: 1, quietos: 0, derivaciones: 0 })).toBe("Para hoy tenés 1 tarea vencida.");
  });

  it("sin nada pendiente lo dice", () => {
    expect(fraseDelResumen({ tareas: 0, vencidas: 0, quietos: 0, derivaciones: 0 })).toMatch(/^Para hoy no tenés tareas/);
  });

  it("separadores", () => {
    expect([0, 1, 2].map((i) => separadorAntes(i, 3))).toEqual(["", ", ", " y "]);
    expect([0, 1].map((i) => separadorAntes(i, 2))).toEqual(["", " y "]);
  });
});

describe("contador de avisos en la pestaña", () => {
  it("agrega, cambia y saca el número", () => {
    expect(tituloConAvisos("Inicio · MuniGestión 3F", 3)).toBe("(3) Inicio · MuniGestión 3F");
    expect(tituloConAvisos("(3) Inicio · MuniGestión 3F", 5)).toBe("(5) Inicio · MuniGestión 3F");
    expect(tituloConAvisos("(5) Inicio · MuniGestión 3F", 0)).toBe("Inicio · MuniGestión 3F");
    expect(tituloConAvisos("Expedientes", 150)).toBe("(99+) Expedientes");
    expect(tituloConAvisos("(99+) Expedientes", 2)).toBe("(2) Expedientes");
  });
});

describe("bienvenida según el rol", () => {
  it("cada rol tiene pasos y todos llevan a pantallas que ese rol puede abrir", () => {
    for (const role of ROLE_ORDER) {
      const b = bienvenidaPara(role);
      expect(b, role).not.toBeNull();
      expect(b!.pasos.length, role).toBeGreaterThanOrEqual(2);
      for (const p of b!.pasos) expect(canAccessPath(role, p.href.split("?")[0]), `${role} ${p.href}`).toBe(true);
    }
  });

  it("quien releva la emergencia no ve el texto del buscador", () => {
    expect(bienvenidaPara("RELEVADOR_EMERGENCIA")!.cierre).toBeNull();
    expect(bienvenidaPara("OPERATIVO")!.cierre).toMatch(/Buscar/);
  });

  it("sin rol no hay bienvenida", () => {
    expect(bienvenidaPara(null)).toBeNull();
    expect(bienvenidaPara("OTRO")).toBeNull();
  });
});
