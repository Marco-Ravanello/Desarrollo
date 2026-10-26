import { describe, expect, it } from "vitest";
import { canViewTeamWorkload, pickLeastLoaded, sortByLoad, suggestAssignee, type WorkloadMember } from "@/lib/team-workload";
import { buildImportTemplate, IMPORT_COLUMNS } from "@/lib/intervention-import";
import { contractTypeLabel, currentMonthRange, hrStatusLabel } from "@/lib/hr-labels";

const member = (over: Partial<WorkloadMember>): WorkloadMember => ({
  userId: "u",
  name: "Persona",
  role: "OPERATIVO",
  member: true,
  eligible: true,
  open: 0,
  urgent: 0,
  stale: 0,
  recent: 0,
  ...over,
});

describe("carga del equipo", () => {
  it("la conducción ve cualquier área; quien dirige, solo la suya", () => {
    expect(canViewTeamWorkload({ role: "SUPERADMIN" }, "a1")).toBe(true);
    expect(canViewTeamWorkload({ role: "DIRECCION_GENERAL" }, "a1")).toBe(true);
    expect(canViewTeamWorkload({ role: "DIRECTOR_AREA", areaId: "a1" }, "a1")).toBe(true);
    expect(canViewTeamWorkload({ role: "DIRECTOR_AREA", areaId: "a2" }, "a1")).toBe(false);
    expect(canViewTeamWorkload({ role: "OPERATIVO", areaId: "a1" }, "a1")).toBe(false);
    expect(canViewTeamWorkload({ role: "SUPERADMIN" }, null)).toBe(false);
  });

  it("propone al profesional del área con menos expedientes, y desempata por urgentes y recientes", () => {
    const rows = [
      member({ userId: "a", name: "Ana", open: 5 }),
      member({ userId: "b", name: "Beto", open: 2, urgent: 1 }),
      member({ userId: "c", name: "Caro", open: 2, urgent: 0, recent: 2 }),
      member({ userId: "d", name: "Dani", open: 2, urgent: 0, recent: 0 }),
      member({ userId: "dir", name: "Directora", role: "DIRECTOR_AREA", open: 0 }),
      member({ userId: "x", name: "De otra área", member: false, open: 0 }),
      member({ userId: "n", name: "Sin permiso", eligible: false, open: 0 }),
    ];
    expect(pickLeastLoaded(rows)?.userId).toBe("d");
    // Si en el área solo está quien la dirige, se la propone a ella.
    expect(pickLeastLoaded([rows[4], rows[5]])?.userId).toBe("dir");
    expect(pickLeastLoaded([rows[5], rows[6]])).toBeNull();
    expect(sortByLoad(rows).map((r) => r.userId).slice(0, 2)).toEqual(["a", "b"]);
  });

  it("en el diálogo de asignar sugiere a quien tiene menos, solo del área", () => {
    const options = [
      { id: "1", name: "Ana", role: "OPERATIVO" as const, open: 3, sameArea: true },
      { id: "2", name: "Beto", role: "OPERATIVO" as const, open: 1, sameArea: true },
      { id: "3", name: "Directora", role: "DIRECTOR_AREA" as const, open: 0, sameArea: true },
      { id: "4", name: "Conducción", role: "SUPERADMIN" as const, open: 0, sameArea: false },
    ];
    expect(suggestAssignee(options)?.id).toBe("2");
    expect(suggestAssignee([options[2], options[3]])?.id).toBe("3");
    expect(suggestAssignee([options[3]])).toBeNull();
  });
});

describe("planilla modelo de intervenciones", () => {
  it("tiene las columnas que lee la importación, vacía, con ayuda y la lista de áreas", () => {
    const [data, help, areas] = buildImportTemplate(["Protección Social", "Niñez"]);
    expect(data.rows).toEqual([[...IMPORT_COLUMNS]]);
    expect(IMPORT_COLUMNS).toEqual(["DNI", "Nombre", "Apellido", "Area", "Caso", "Descripcion", "Fecha"]);
    expect(help.rows.slice(1, 1 + IMPORT_COLUMNS.length).map((r) => r[0])).toEqual([...IMPORT_COLUMNS]);
    expect(areas.rows).toEqual([["Area"], ["Protección Social"], ["Niñez"]]);
    for (const sheet of [data, help, areas]) {
      expect(sheet.name.length).toBeLessThanOrEqual(31);
      expect(sheet.widths.length).toBe(sheet.rows[0].length);
    }
  });
});

describe("Recursos Humanos", () => {
  it("el mes en curso se toma en hora de Argentina", () => {
    // 1/12 a las 01:00 UTC todavía es 30/11 en Argentina.
    expect(currentMonthRange(new Date("2026-12-01T01:00:00Z"))).toEqual({
      from: new Date("2026-11-01T00:00:00Z"),
      to: new Date("2026-12-01T00:00:00Z"),
    });
    expect(currentMonthRange(new Date("2026-12-31T23:00:00Z"))).toEqual({
      from: new Date("2026-12-01T00:00:00Z"),
      to: new Date("2027-01-01T00:00:00Z"),
    });
  });

  it("muestra estados y contratos en castellano", () => {
    expect(hrStatusLabel("LICENCIA")).toBe("De licencia");
    expect(hrStatusLabel(null)).toBe("Activo");
    expect(contractTypeLabel("PLANTA_PERMANENTE")).toBe("Planta permanente");
    expect(contractTypeLabel(undefined)).toBe("Mensualizado");
  });
});
