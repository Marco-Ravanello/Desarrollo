import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkExportRange, exportFileName, exportPresets, exportRangeText, isDay, EXPORT_MAX_DAYS } from "@/lib/intervention-export";

describe("bajar intervenciones por período y área (idea 135)", () => {
  const today = "2026-11-12";

  it("ofrece atajos de período", () => {
    const p = Object.fromEntries(exportPresets(today).map((x) => [x.key, x.range]));
    expect(p.mes).toEqual({ desde: "2026-11-01", hasta: "2026-11-12" });
    expect(p["mes-pasado"]).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(p["90"]).toEqual({ desde: "2026-08-15", hasta: "2026-11-12" });
    expect(p.anio).toEqual({ desde: "2026-01-01", hasta: "2026-11-12" });
    expect(Object.fromEntries(exportPresets("2026-01-05").map((x) => [x.key, x.range]))["mes-pasado"]).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
  });

  it("revisa las fechas y arma el período en hora argentina", () => {
    expect(isDay("2026-02-30")).toBe(false);
    expect(checkExportRange({ desde: "2026-11-01" }, today).ok).toBe(false);
    expect(checkExportRange({ desde: "2026-11-10", hasta: "2026-11-01" }, today).ok).toBe(false);
    expect(checkExportRange({ desde: "2026-12-01", hasta: "2026-12-31" }, today).ok).toBe(false);
    expect(checkExportRange({ desde: "2024-01-01", hasta: "2026-11-12" }, today)).toEqual({ ok: false, error: "Elegí un período de hasta un año." });
    expect(EXPORT_MAX_DAYS).toBe(366);
    const r = checkExportRange({ desde: "2026-11-01", hasta: "2026-11-12" }, today);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.from.toISOString()).toBe("2026-11-01T03:00:00.000Z");
      expect(r.toExclusive.toISOString()).toBe("2026-11-13T03:00:00.000Z");
    }
  });

  it("dice qué se bajó y nombra el archivo", () => {
    expect(exportRangeText({ desde: "2026-11-01", hasta: "2026-11-12" }, "Dirección de Protección Social")).toBe(
      "del 01/11/2026 al 12/11/2026, Dirección de Protección Social"
    );
    expect(exportRangeText({ desde: "2026-11-12", hasta: "2026-11-12" })).toBe("del 12/11/2026, todas las áreas");
    expect(exportFileName({ desde: "2026-11-01", hasta: "2026-11-12" }, "Niñez y Adolescencia")).toBe("Intervenciones_2026-11-01_a_2026-11-12_Ninez_y_Adolescencia.xlsx");
    expect(exportFileName({ desde: "2026-11-01", hasta: "2026-11-12" })).toBe("Intervenciones_2026-11-01_a_2026-11-12.xlsx");
  });
});

describe("índices en la base (idea 131)", () => {
  it("la migración solo agrega índices", () => {
    const sql = readFileSync("prisma/migrations/20261112300000_indices_historial/migration.sql", "utf8");
    const statements = sql.split(";").map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean);
    expect(statements.length).toBe(7);
    expect(statements.every((s) => s.startsWith("CREATE INDEX IF NOT EXISTS"))).toBe(true);
    expect(sql).toContain('"Intervention"("personId", "date")');
    expect(sql).toContain('"Task"("userId", "dueDate")');
  });
});
