import { describe, expect, it } from "vitest";
import {
  chipsThatFit, dateOnlyToLocal, isDateOnly, localDayKey, monthCells, shortEventLabel, startOfWeekMonday, weekdayFromMonday,
} from "@/lib/agenda";

describe("semanas de lunes a domingo", () => {
  it("cuenta los días desde el lunes", () => {
    expect(weekdayFromMonday(new Date(2026, 9, 19))).toBe(0); // lunes 19/10
    expect(weekdayFromMonday(new Date(2026, 9, 25))).toBe(6); // domingo 25/10
  });

  it("el domingo pertenece a la semana que empezó el lunes anterior", () => {
    expect(localDayKey(startOfWeekMonday(new Date(2026, 9, 25, 18)))).toBe("2026-10-19");
    expect(localDayKey(startOfWeekMonday(new Date(2026, 9, 26)))).toBe("2026-10-26");
  });

  it("el mes arranca en la columna del lunes y completa semanas enteras", () => {
    // Octubre de 2026 empieza un jueves y tiene 31 días.
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]?.getDate()).toBe(1);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(31);
    // Febrero de 2027 empieza un lunes: sin huecos adelante.
    expect(monthCells(2027, 1)[0]?.getDate()).toBe(1);
  });
});

describe("fechas sin hora", () => {
  it("reconoce la medianoche UTC de los campos de fecha", () => {
    expect(isDateOnly(new Date("2026-10-28T00:00:00.000Z"))).toBe(true);
    expect(isDateOnly(new Date("2026-10-28T13:00:00.000Z"))).toBe(false);
  });

  it("la pasa al mismo día del calendario, no al anterior", () => {
    expect(localDayKey(dateOnlyToLocal(new Date("2026-10-28T00:00:00.000Z")))).toBe("2026-10-28");
  });
});

describe("nombre corto y casillas", () => {
  it("usa la patente, la orden o el título", () => {
    expect(shortEventLabel("reservation", { vehicle: { plate: "AB123CD" } })).toBe("AB123CD");
    expect(shortEventLabel("order", { number: "12" })).toBe("Entrega OC 12");
    expect(shortEventLabel("order", {})).toBe("Entrega de orden");
    expect(shortEventLabel("task", { title: "  Llamar a la escuela " })).toBe("Llamar a la escuela");
  });

  it("deja lugar para el \"+N más\" cuando no entran todos", () => {
    expect(chipsThatFit([1, 2, 3], 3)).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(chipsThatFit([1, 2, 3, 4, 5], 3)).toEqual({ shown: [1, 2], more: 3 });
  });
});
