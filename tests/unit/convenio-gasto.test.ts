import { describe, expect, it } from "vitest";
import {
  canClosePeriod, canLoadHours, canReopenPeriod, canViewCostDetail, listaDeDias, parseEgreso, moverPeriodo, nivelDe, parseConfig, parseHoras, parseImporte, periodoDe, periodoTexto,
  resumirPeriodo, SIN_CUIDADORA, valorHoraDel,
} from "@/lib/convenio-gasto";

describe("períodos del control por horas", () => {
  it("van del día de corte al día anterior del mes siguiente", () => {
    expect(periodoDe("2026-10-25", 20)).toEqual({ desde: "2026-10-20", hasta: "2026-11-19" });
    expect(periodoDe("2026-10-20", 20)).toEqual({ desde: "2026-10-20", hasta: "2026-11-19" });
    expect(periodoDe("2026-10-19", 20)).toEqual({ desde: "2026-09-20", hasta: "2026-10-19" });
    expect(periodoDe("2026-01-05", 20)).toEqual({ desde: "2025-12-20", hasta: "2026-01-19" });
    expect(periodoDe("2026-02-15", 1)).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(periodoDe("2028-02-15", 1).hasta).toBe("2028-02-29");
  });

  it("se mueven al anterior y al siguiente", () => {
    const p = periodoDe("2026-10-25", 20);
    expect(moverPeriodo(p, -1, 20)).toEqual({ desde: "2026-09-20", hasta: "2026-10-19" });
    expect(moverPeriodo(p, 1, 20)).toEqual({ desde: "2026-11-20", hasta: "2026-12-19" });
    expect(periodoTexto(p)).toBe("20/10 al 19/11/2026");
    expect(periodoTexto(periodoDe("2026-01-05", 20))).toBe("20/12/2025 al 19/01/2026");
  });
});

describe("valor hora con historial", () => {
  const valores = [
    { desde: "2026-09-01", valor: 12926 },
    { desde: "2026-10-10", valor: 13500 },
  ];
  it("cada día usa el último valor que empezó ese día o antes", () => {
    expect(valorHoraDel("2026-08-31", valores)).toBeNull();
    expect(valorHoraDel("2026-09-01", valores)).toBe(12926);
    expect(valorHoraDel("2026-10-09", valores)).toBe(12926);
    expect(valorHoraDel("2026-10-10", valores)).toBe(13500);
  });
});

describe("resumen del período", () => {
  const periodo = { desde: "2026-09-20", hasta: "2026-10-19" };
  const valores = [
    { desde: "2026-09-01", valor: 10000 },
    { desde: "2026-09-22", valor: 12000 },
  ];
  const fila = (fecha: string, cuidadoraId: string, dni: string, horas: number) => ({
    fecha, cuidadoraId, cuidadora: cuidadoraId === "c1" ? "Ana" : "Bea", dni, nombre: `NNyA ${dni}`, horas,
  });
  const filas = [
    fila("2026-09-20", "c1", "1", 24),
    fila("2026-09-21", "c1", "1", 24),
    fila("2026-09-22", "c1", "1", 12),
    fila("2026-09-22", "c2", "2", 12),
    fila("2026-10-25", "c1", "1", 24), // fuera del período
  ];

  it("suma con el valor de cada día, por cuidadora y por NNyA", () => {
    const r = resumirPeriodo({ periodo, filas, valores, tope: 1_000_000, hoy: "2026-09-24" });
    expect(r.horas).toBe(72);
    expect(r.gastado).toBe(24 * 10000 * 2 + 24 * 12000);
    expect(r.disponible).toBe(1_000_000 - 768000);
    expect(r.porCuidadora.map((c) => [c.nombre, c.horas, c.importe])).toEqual([["Ana", 60, 624000], ["Bea", 12, 144000]]);
    expect(r.porNnya.find((n) => n.dni === "1")).toMatchObject({ dias: 3, horas: 60 });
    expect(r.diasSinHoras).toEqual(["2026-09-23", "2026-09-24"]);
  });

  it("las horas sin cuidadora suman igual y van al final de la lista por cuidadora", () => {
    const sin = { fecha: "2026-09-23", cuidadoraId: null, cuidadora: null, dni: "3", nombre: "NNyA 3", horas: 100 };
    const r = resumirPeriodo({ periodo, filas: [...filas, sin], valores, tope: null, hoy: "2026-09-24" });
    expect(r.horas).toBe(172);
    expect(r.porCuidadora.map((c) => [c.id, c.nombre, c.horas])).toEqual([
      ["c1", "Ana", 60],
      ["c2", "Bea", 12],
      [SIN_CUIDADORA, "Sin cuidadora cargada", 100],
    ]);
    expect(r.porNnya.find((n) => n.dni === "3")).toMatchObject({ horas: 100, dias: 1 });
  });

  it("proyecta con las horas del último día cargado y avisa si se pasa", () => {
    const r = resumirPeriodo({ periodo, filas, valores, tope: 1_000_000, hoy: "2026-09-24" });
    // Del 23/09 al 19/10 son 27 días, con 24 h por día a $ 12.000.
    expect(r.ultimoDia).toEqual({ fecha: "2026-09-22", horas: 24 });
    expect(r.diasRestantes).toBe(27);
    expect(r.proyeccion).toBe(768000 + 24 * 12000 * 27);
    expect(r.excedente).toBe(768000 + 24 * 12000 * 27 - 1_000_000);
    expect(r.nivel).toBe("precaucion");
  });

  it("con el período terminado, la proyección es lo gastado", () => {
    const r = resumirPeriodo({ periodo, filas, valores, tope: 500_000, hoy: "2026-11-01" });
    expect(r.proyeccion).toBe(r.gastado);
    expect(r.disponible).toBeLessThan(0);
    expect(r.nivel).toBe("critico");
  });

  it("las horas de días sin valor hora no se cuentan en pesos", () => {
    const r = resumirPeriodo({ periodo, filas: [fila("2026-09-20", "c1", "1", 10)], valores: [{ desde: "2026-10-01", valor: 1 }], tope: 100, hoy: "2026-09-20" });
    expect(r.gastado).toBe(0);
    expect(r.horasSinValor).toBe(10);
  });
});

describe("semáforo", () => {
  it("usa los avisos del convenio", () => {
    expect(nivelDe(69.9)).toBe("bien");
    expect(nivelDe(70)).toBe("precaucion");
    expect(nivelDe(85)).toBe("alerta");
    expect(nivelDe(110)).toBe("critico");
    expect(nivelDe(55, [50, 60, 90])).toBe("precaucion");
  });
});

describe("lo que se carga", () => {
  const ok = { fecha: "2026-10-28", cuidadoraId: "c1", dni: "12345678", horas: "24", lugar: "HOSPITAL" };
  it("revisa cada fila de horas", () => {
    expect(parseHoras(ok, "2026-10-29")).toMatchObject({ ok: true, data: { horas: 24, lugar: "HOSPITAL" } });
    expect(parseHoras({ ...ok, fecha: "2026-10-30" }, "2026-10-29")).toMatchObject({ ok: false, error: expect.stringMatching(/todavía no pasaron/) });
    expect(parseHoras({ ...ok, horas: "25" }, "2026-10-29")).toMatchObject({ ok: false, error: expect.stringMatching(/24 horas/) });
    expect(parseHoras({ ...ok, horas: "7,5" }, "2026-10-29")).toMatchObject({ ok: true, data: { horas: 7.5 } });
    expect(parseHoras({ ...ok, horas: "7,3" }, "2026-10-29").ok).toBe(false);
    // La cuidadora es opcional (las contrata la asociación); el niño, niña o adolescente no.
    expect(parseHoras({ ...ok, cuidadoraId: "" }, "2026-10-29")).toMatchObject({ ok: true, data: { cuidadoraId: null } });
    expect(parseHoras({ ...ok, dni: "" }, "2026-10-29")).toMatchObject({ ok: false, error: expect.stringMatching(/niño, niña o adolescente/) });
    expect(parseHoras({ ...ok, lugar: "PLAZA" }, "2026-10-29").ok).toBe(false);
  });

  it("lee importes como se escriben", () => {
    expect(parseImporte("33.000.000")).toBe(33000000);
    expect(parseImporte("$ 12.926,50")).toBe(12926.5);
    expect(parseImporte("12926.5")).toBe(12926.5);
    expect(parseImporte("")).toBeNull();
  });

  it("pide los avisos de menor a mayor", () => {
    expect(parseConfig({ monthlyCap: "33000000", periodStartDay: "20", alerta1: "70", alerta2: "85", alerta3: "95" })).toMatchObject({ ok: true });
    expect(parseConfig({ monthlyCap: "33000000", periodStartDay: "31", alerta1: "70", alerta2: "85", alerta3: "95" }).ok).toBe(false);
    expect(parseConfig({ monthlyCap: "33000000", periodStartDay: "20", alerta1: "90", alerta2: "85", alerta3: "95" }).ok).toBe(false);
    expect(parseConfig({ monthlyCap: "", periodStartDay: "20", alerta1: "70", alerta2: "85", alerta3: "95" }).ok).toBe(false);
  });

  it("agrupa días sueltos", () => {
    expect(listaDeDias(["2026-10-06", "2026-10-07"])).toBe("06/10 y 07/10");
    expect(listaDeDias(["2026-10-06", "2026-10-07", "2026-10-08"], 2)).toBe("06/10, 07/10 y 1 más");
  });
});

describe("quién ve y quién carga", () => {
  const convenio = { areaId: "ninez" };
  it("la conducción todo; el área carga; Auditoría solo mira", () => {
    expect(canLoadHours({ role: "ADMIN_GENERAL" }, convenio)).toBe(true);
    expect(canLoadHours({ role: "OPERATIVO", areaId: "ninez" }, convenio)).toBe(true);
    expect(canLoadHours({ role: "OPERATIVO", areaId: "otra" }, convenio)).toBe(false);
    expect(canLoadHours({ role: "AUDITOR" }, convenio)).toBe(false);
    expect(canViewCostDetail({ role: "AUDITOR" }, convenio)).toBe(true);
    expect(canViewCostDetail({ role: "DIRECTOR_AREA", areaId: "otra" }, convenio)).toBe(false);
    expect(canViewCostDetail({ role: "RELEVADOR_EMERGENCIA", areaId: "ninez" }, convenio)).toBe(false);
  });
});

describe("cierre del período y NNyA", () => {
  it("cierran la conducción y la dirección del área; reabre solo la conducción", () => {
    const convenio = { areaId: "ninez" };
    expect(canClosePeriod({ role: "ADMIN_GENERAL" }, convenio)).toBe(true);
    expect(canClosePeriod({ role: "DIRECTOR_AREA", areaId: "ninez" }, convenio)).toBe(true);
    expect(canClosePeriod({ role: "DIRECTOR_AREA", areaId: "otra" }, convenio)).toBe(false);
    expect(canClosePeriod({ role: "OPERATIVO", areaId: "ninez" }, convenio)).toBe(false);
    expect(canReopenPeriod("SUPERADMIN")).toBe(true);
    expect(canReopenPeriod("DIRECTOR_AREA")).toBe(false);
  });

  it("la proyección no cuenta a los NNyA que egresaron", () => {
    const filas = [
      { fecha: "2026-10-21", cuidadoraId: "c1", cuidadora: "Ana", dni: "1", nombre: "A", horas: 10 },
      { fecha: "2026-10-21", cuidadoraId: "c1", cuidadora: "Ana", dni: "2", nombre: "B", horas: 6 },
    ];
    const base = { periodo: { desde: "2026-10-20", hasta: "2026-11-19" }, filas, valores: [{ desde: "2026-01-01", valor: 100 }], tope: 100000, hoy: "2026-10-21" };
    const todos = resumirPeriodo(base);
    expect(todos.horasBase).toBe(16);
    expect(todos.proyeccion).toBe(1600 + 16 * 100 * 29);
    const sinB = resumirPeriodo({ ...base, egresados: ["2"] });
    expect(sinB.horasBase).toBe(10);
    expect(sinB.proyeccion).toBe(1600 + 10 * 100 * 29);
    expect(sinB.gastado).toBe(1600);
  });

  it("el egreso va entre el ingreso y hoy", () => {
    expect(parseEgreso({ fecha: "2026-10-25", motivo: " Alta " }, "2026-10-20", "2026-10-29")).toEqual({
      ok: true,
      data: { fecha: "2026-10-25", motivo: "Alta" },
    });
    expect(parseEgreso({ fecha: "2026-10-19" }, "2026-10-20", "2026-10-29").ok).toBe(false);
    expect(parseEgreso({ fecha: "2026-10-30" }, "2026-10-20", "2026-10-29").ok).toBe(false);
    expect(parseEgreso({ fecha: "" }, "2026-10-20", "2026-10-29").ok).toBe(false);
  });
});
