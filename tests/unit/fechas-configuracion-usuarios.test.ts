import { describe, expect, it } from "vitest";
import {
  diaDeVencimiento, diasEntre, formatFecha, formatFechaCalendario, formatFechaHora, formatFechaLarga, formatHora, formatVencimiento,
} from "@/lib/fechas";
import { lastLoginInfo } from "@/lib/user-activity";
import { DEFAULT_MUNICIPAL_SETTINGS, cleanSettings, toPublicSettings } from "@/types/settings";

describe("fechas y horas en hora argentina", () => {
  // 15:39 en Argentina = 18:39 UTC.
  const tarde = new Date("2026-10-22T18:39:00Z");
  // 22:30 en Argentina = 01:30 UTC del día siguiente.
  const noche = new Date("2026-10-23T01:30:00Z");

  it("día/mes/año y 24 horas, aunque el servidor esté en UTC", () => {
    expect(formatFecha(tarde)).toBe("22/10/2026");
    expect(formatHora(tarde)).toBe("15:39");
    expect(formatFechaHora(tarde)).toBe("22/10/2026 15:39");
    expect(formatFechaHora(noche)).toBe("22/10/2026 22:30");
    expect(formatFechaLarga(tarde)).toBe("jueves, 22 de octubre de 2026");
  });

  it("las fechas de calendario (vencimientos) no se corren un día", () => {
    const vtv = new Date("2026-12-03T00:00:00Z");
    expect(formatFechaCalendario(vtv)).toBe("03/12/2026");
    expect(formatFecha(vtv)).toBe("02/12/2026");
    expect(diaDeVencimiento(vtv)).toBe("2026-12-03");
    expect(formatVencimiento(vtv)).toBe("03/12");
    // Una tarea con hora se toma en hora argentina.
    expect(diaDeVencimiento(noche)).toBe("2026-10-22");
    expect(diasEntre("2026-10-22", "2026-10-25")).toBe(3);
  });

  it("sin fecha, texto vacío", () => {
    expect(formatFecha(null)).toBe("");
    expect(formatFechaHora("cualquier cosa")).toBe("");
  });
});

describe("último ingreso de los usuarios", () => {
  const ahora = new Date("2026-10-23T15:00:00Z");

  it("dice hace cuánto entró y marca las cuentas sin uso", () => {
    expect(lastLoginInfo(new Date("2026-10-23T12:00:00Z"), "2025-01-01", null, ahora)).toMatchObject({ label: "Hoy", unused: false });
    expect(lastLoginInfo(new Date("2026-10-22T12:00:00Z"), "2025-01-01", null, ahora).label).toBe("Ayer");
    expect(lastLoginInfo(new Date("2026-10-13T12:00:00Z"), "2025-01-01", null, ahora).label).toBe("Hace 10 días");
    expect(lastLoginInfo(new Date("2026-08-01T12:00:00Z"), "2025-01-01", null, ahora)).toMatchObject({ label: "01/08/2026", unused: true });
  });

  it("si nunca entró, cuenta desde el alta o desde que se registran los ingresos", () => {
    expect(lastLoginInfo(null, "2026-10-01", "2026-01-01", ahora)).toMatchObject({ label: "Sin ingresos", unused: false });
    expect(lastLoginInfo(null, "2025-01-01", "2026-01-01", ahora).unused).toBe(true);
    // Los ingresos se registran hace poco: todavía no se puede decir que no la usa.
    expect(lastLoginInfo(null, "2025-01-01", "2026-10-01", ahora).unused).toBe(false);
  });
});

describe("Configuración", () => {
  it("guarda solo los campos conocidos (los controles viejos se descartan)", () => {
    const s = cleanSettings({ municipalityName: "Muni", maintenanceMode: true, sessionTimeout: "8", mainPhone: 123 });
    expect(s.municipalityName).toBe("Muni");
    expect(s.mainPhone).toBe(DEFAULT_MUNICIPAL_SETTINGS.mainPhone);
    expect("maintenanceMode" in s).toBe(false);
  });

  it("el logo propio no viaja en cada página, se pide aparte", () => {
    const pub = toPublicSettings({ ...DEFAULT_MUNICIPAL_SETTINGS, customLogoUrl: "data:image/png;base64,AAAA" });
    expect("customLogoUrl" in pub).toBe(false);
    expect(pub.logoUrl).toMatch(/^\/api\/logo\?v=/);
    expect(toPublicSettings(DEFAULT_MUNICIPAL_SETTINGS).logoUrl).toBeNull();
  });
});
