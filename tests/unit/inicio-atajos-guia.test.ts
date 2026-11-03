import { describe, expect, it } from "vitest";
import { applyHomeLayout, homeLayoutRows, parseHomeLayout, type HomeSectionId } from "@/lib/home-layout";
import { vehicleExpiryInfo } from "@/lib/vencimientos";
import { accionDeTecla, estaEscribiendo } from "@/lib/atajos";
import { guiaPara } from "@/lib/ayuda";

const ROL: HomeSectionId[] = ["areas", "away", "programs", "attention", "budget"];

describe("orden de las tarjetas del Inicio", () => {
  it("sin preferencia queda el orden de siempre", () => {
    expect(applyHomeLayout(ROL, null)).toEqual(ROL);
  });

  it("respeta el orden elegido, esconde las destildadas y deja al final las nuevas", () => {
    const pref = { order: ["budget", "areas", "away"] as HomeSectionId[], hidden: ["away"] as HomeSectionId[] };
    expect(applyHomeLayout(ROL, pref)).toEqual(["budget", "areas", "programs", "attention"]);
  });

  it("no suma tarjetas que el rol no tiene", () => {
    const pref = { order: ["vehicles", "budget"] as HomeSectionId[], hidden: [] };
    expect(applyHomeLayout(ROL, pref)).toEqual(["budget", "areas", "away", "programs", "attention"]);
  });

  it("descarta datos que no sirven", () => {
    expect(parseHomeLayout(null)).toBeNull();
    expect(parseHomeLayout("x")).toBeNull();
    expect(parseHomeLayout({ order: ["nada", 3], hidden: [] })).toBeNull();
    expect(parseHomeLayout({ order: ["tasks", "tasks", "otra"], hidden: ["budget"] })).toEqual({ order: ["tasks"], hidden: ["budget"] });
  });

  it("el diálogo muestra todas las del rol, con las escondidas marcadas", () => {
    const rows = homeLayoutRows(ROL, { order: ["budget"], hidden: ["areas"] });
    expect(rows.map((r) => r.id)).toEqual(["budget", "areas", "away", "programs", "attention"]);
    expect(rows.find((r) => r.id === "areas")?.visible).toBe(false);
    expect(rows[0].label).toBe("Presupuesto");
  });
});

describe("vencimientos de los vehículos en el Inicio", () => {
  const hoy = "2026-11-03";
  it("marca en rojo la VTV o el seguro vencidos", () => {
    expect(vehicleExpiryInfo("2026-10-10", "2027-05-01", hoy)).toMatchObject({ text: "VTV vencida el 10/10", overdue: true });
    expect(vehicleExpiryInfo("2027-05-01", "2026-11-02", hoy)).toMatchObject({ text: "Seguro vencido el 02/11", overdue: true });
    expect(vehicleExpiryInfo("2026-01-01", "2026-02-01", hoy)).toMatchObject({ text: "VTV y seguro vencidos", overdue: true });
  });

  it("avisa lo que vence en el próximo mes y no cuenta hoy como vencido", () => {
    expect(vehicleExpiryInfo("2026-11-03", null, hoy)).toMatchObject({ text: "La VTV vence el 03/11", overdue: false, soon: true });
    expect(vehicleExpiryInfo("2027-06-30", "2026-11-20", hoy)).toMatchObject({ text: "El seguro vence el 20/11", soon: true });
  });

  it("lo lejano o sin fechas no se marca", () => {
    expect(vehicleExpiryInfo("2027-06-30", null, hoy)).toMatchObject({ text: "VTV hasta 06/27", overdue: false, soon: false });
    expect(vehicleExpiryInfo(null, null, hoy)).toMatchObject({ text: "Sin vencimientos cargados", nearest: null });
  });
});

describe("atajos de teclado", () => {
  it("cada tecla hace lo suyo, y N solo para quien carga expedientes", () => {
    expect(accionDeTecla("/", false)).toBe("buscar");
    expect(accionDeTecla("?", false)).toBe("atajos");
    expect(accionDeTecla("g", false)).toBe("guia");
    expect(accionDeTecla("n", true)).toBe("nuevo-expediente");
    expect(accionDeTecla("N", false)).toBeNull();
    expect(accionDeTecla("x", true)).toBeNull();
  });

  it("no corren mientras se escribe", () => {
    expect(estaEscribiendo({ tagName: "INPUT" } as Element)).toBe(true);
    expect(estaEscribiendo({ tagName: "TEXTAREA" } as Element)).toBe(true);
    expect(estaEscribiendo({ tagName: "DIV", isContentEditable: true } as unknown as Element)).toBe(true);
    expect(estaEscribiendo({ tagName: "BUTTON", isContentEditable: false } as unknown as Element)).toBe(false);
    expect(estaEscribiendo(null)).toBe(false);
  });
});

describe("guía de cada pantalla", () => {
  it("elige la guía más específica", () => {
    expect(guiaPara("/dashboard").pantalla).toBe("Inicio");
    expect(guiaPara("/people").pantalla).toBe("Registro Único");
    expect(guiaPara("/people/30275822").pantalla).toBe("Ficha de la persona");
    expect(guiaPara("/people/programas/tarjeta_alimentar").pantalla).toBe("Programas");
    expect(guiaPara("/people/new").pantalla).toBe("Cargar persona");
    expect(guiaPara("/cases").pantalla).toBe("Expedientes");
    expect(guiaPara("/cases/new").pantalla).toBe("Nuevo expediente");
    expect(guiaPara("/cases/abc123").pantalla).toBe("Expediente");
    expect(guiaPara("/barrios/caseros/recorrida").pantalla).toBe("Preparar recorrida");
  });

  it("las pantallas sin guía propia muestran la general, y ninguna guía está vacía", () => {
    expect(guiaPara("/admin/settings").pantalla).toBe("Esta pantalla");
    for (const path of ["/dashboard", "/people", "/cases", "/maps", "/tasks", "/admin/calendar", "/cursos", "/admin/users"]) {
      const g = guiaPara(path);
      expect(g.preguntas.length).toBeGreaterThan(0);
      for (const q of g.preguntas) expect(q.r.length).toBeGreaterThan(0);
    }
  });
});
