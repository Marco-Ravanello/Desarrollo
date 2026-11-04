import { describe, expect, it } from "vitest";
import {
  dayToDate, leaveDays, leavesOverlap, monthDays, monthFromParam, readLeaveInput, shiftMonth, spansInMonth, statusForLeave, yearSummary,
} from "@/lib/hr-leaves";
import { formatMoneyTyping, moneyFromNumber, moneyToPlain } from "@/lib/money-input";
import { readHRForm } from "@/lib/hr-form";

const d = (s: string) => dayToDate(s)!;

describe("licencias del personal", () => {
  it("cuenta los días con el primero y el último incluidos", () => {
    expect(leaveDays(d("2026-11-03"), d("2026-11-05"))).toBe(3);
    expect(leaveDays(d("2026-11-03"), d("2026-11-03"))).toBe(1);
    expect(leaveDays(d("2026-02-27"), d("2026-03-02"))).toBe(4);
  });

  it("rechaza fechas que no existen o al revés", () => {
    expect(dayToDate("2026-02-30")).toBeNull();
    expect(readLeaveInput({ kind: "VACACIONES", startDate: "2026-11-10", endDate: "2026-11-09" })).toMatchObject({ ok: false });
    expect(readLeaveInput({ kind: "INVENTADA", startDate: "2026-11-10", endDate: "2026-11-10" })).toMatchObject({ ok: false, error: "Elegí el tipo de licencia." });
    expect(readLeaveInput({ kind: "ENFERMEDAD", startDate: "2026-01-01", endDate: "2027-06-01" })).toMatchObject({ ok: false });
    const ok = readLeaveInput({ kind: "ENFERMEDAD", startDate: "2026-11-10", endDate: "2026-11-12", notes: "  con   certificado " });
    expect(ok).toMatchObject({ ok: true, data: { notes: "con certificado" } });
  });

  it("suma los días del año por tipo, recortando lo que cae en otro año", () => {
    const s = yearSummary(
      [
        { kind: "VACACIONES", startDate: d("2025-12-29"), endDate: d("2026-01-09") },
        { kind: "ENFERMEDAD", startDate: d("2026-03-02"), endDate: d("2026-03-03") },
        { kind: "VACACIONES", startDate: d("2026-07-20"), endDate: d("2026-07-24") },
      ],
      2026
    );
    expect(s.total).toBe(16);
    expect(s.byKind).toEqual([
      { kind: "VACACIONES", label: "Vacaciones", days: 14 },
      { kind: "ENFERMEDAD", label: "Licencia médica", days: 2 },
    ]);
  });

  it("las vacaciones dejan el legajo en Vacaciones y lo demás en Licencia", () => {
    expect(statusForLeave("VACACIONES")).toBe("VACACIONES");
    expect(statusForLeave("DUELO")).toBe("LICENCIA");
  });

  it("del 1 al 5 y del 5 al 8 se pisan; del 1 al 4 y del 5 al 8, no", () => {
    expect(leavesOverlap({ startDate: d("2026-11-01"), endDate: d("2026-11-05") }, { startDate: d("2026-11-05"), endDate: d("2026-11-08") })).toBe(true);
    expect(leavesOverlap({ startDate: d("2026-11-01"), endDate: d("2026-11-04") }, { startDate: d("2026-11-05"), endDate: d("2026-11-08") })).toBe(false);
  });

  it("arma el mes y recorta las licencias que vienen de antes o siguen después", () => {
    const days = monthDays(2026, 11);
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ day: 1, weekday: 6, weekend: true }); // domingo 1/11/2026
    expect(days[1]).toMatchObject({ day: 2, weekday: 0, weekend: false });
    const spans = spansInMonth(
      [
        { id: "a", kind: "VACACIONES", startDate: d("2026-10-26"), endDate: d("2026-11-06") },
        { id: "b", kind: "ENFERMEDAD", startDate: d("2026-11-28"), endDate: d("2026-12-03") },
        { id: "c", kind: "ESTUDIO", startDate: d("2026-12-10"), endDate: d("2026-12-10") },
      ],
      2026,
      11
    );
    expect(spans.map((s) => [s.id, s.from, s.to])).toEqual([["a", 1, 6], ["b", 28, 30]]);
  });

  it("lee el mes pedido y pasa de diciembre a enero", () => {
    expect(monthFromParam("2026-02", "2026-11-04")).toEqual({ year: 2026, month: 2 });
    expect(monthFromParam("cualquiera", "2026-11-04")).toEqual({ year: 2026, month: 11 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("remuneración con puntos de miles", () => {
  it("muestra los puntos mientras se escribe y guarda el número limpio", () => {
    expect(formatMoneyTyping("450000")).toBe("450.000");
    expect(formatMoneyTyping("1234567,891")).toBe("1.234.567,89");
    expect(formatMoneyTyping("$ 12a3")).toBe("123");
    expect(formatMoneyTyping(",5")).toBe("0,5");
    expect(moneyToPlain("1.234.567,89")).toBe("1234567.89");
    expect(moneyToPlain("")).toBe("");
    expect(moneyFromNumber(450000)).toBe("450.000");
    expect(moneyFromNumber("1234.50")).toBe("1.234,5");
    expect(moneyFromNumber(0)).toBe("");
  });

  it("el formulario lee el sueldo limpio o como se ve", () => {
    const base = { firstName: "A", lastName: "B", dni: "30111222", areaId: "x", position: "C" };
    const salaryOf = (salary: string) => {
      const r = readHRForm((k) => ({ ...base, salary } as Record<string, string>)[k] ?? null);
      return r.ok ? r.data.salary : NaN;
    };
    expect(salaryOf("450000.5")).toBe(450000.5);
    expect(salaryOf("450.000")).toBe(450000);
    expect(salaryOf("450.000,50")).toBe(450000.5);
    expect(salaryOf("1234,5")).toBe(1234.5);
  });
});
