import { describe, expect, it } from "vitest";
import {
  blockTimeLabel, blocksForDay, horaCorta, clampDrag, durationLabel, firstConflict, gridHoursFor, slotCount, slotIsPast, slotRange, toLocalInput,
} from "@/lib/vehicle-grid";

const day = new Date(2026, 10, 10); // martes 10/11/2026
const at = (h: number, m = 0, d = 10) => new Date(2026, 10, d, h, m);
const res = (id: string, s: Date, e: Date, status = "APROBADA") => ({ id, startDate: s, endDate: e, status, user: { name: "Ana" } });

describe("grilla de reservas de vehículos", () => {
  it("muestra de 7 a 21 y se estira si una reserva se sale", () => {
    expect(gridHoursFor([], [day])).toEqual([7, 21]);
    expect(gridHoursFor([res("a", at(6), at(8))], [day])).toEqual([6, 21]);
    expect(gridHoursFor([res("a", at(20), at(22, 30))], [day])).toEqual([7, 23]);
    // Una reserva de varios días no estira el día del medio.
    expect(gridHoursFor([res("a", at(10, 0, 9), at(10, 0, 11))], [day])).toEqual([7, 21]);
    // Las canceladas no cuentan.
    expect(gridHoursFor([res("a", at(5), at(6), "CANCELADA")], [day])).toEqual([7, 21]);
  });

  it("recorta los bloques al día y marca los que vienen de antes o siguen después", () => {
    const hours: [number, number] = [7, 21];
    const blocks = blocksForDay([res("a", at(9), at(11)), res("b", at(18, 0, 9), at(8)), res("c", at(9), at(10), "RECHAZADA")], day, hours);
    expect(blocks.map((b) => b.id)).toEqual(["b", "a"]);
    const a = blocks.find((b) => b.id === "a")!;
    expect(a.top).toBeCloseTo(2 / 14);
    expect(a.height).toBeCloseTo(2 / 14);
    const b = blocks.find((x) => x.id === "b")!;
    expect(b.top).toBe(0);
    expect(b.fromBefore).toBe(true);
    expect(b.toAfter).toBe(false);
  });

  it("arma la salida y la vuelta desde los tramos de media hora, en cualquier orden", () => {
    const hours: [number, number] = [7, 21];
    expect(slotCount(hours)).toBe(28);
    const r = slotRange(day, 5, 2, hours);
    expect(r.start).toEqual(at(8));
    expect(r.end).toEqual(at(10));
  });

  it("al arrastrar no pasa por encima de una reserva ni del pasado", () => {
    const hours: [number, number] = [7, 21];
    const busy = [res("a", at(10), at(11))];
    const morning = at(6);
    // De 8:00 (tramo 2) hacia 12:00: frena en 9:30 (tramo 5), antes de la reserva de las 10.
    expect(clampDrag(busy, day, 2, 10, hours, morning)).toBe(5);
    // Hacia atrás desde 9:00 con el reloj a las 8:10: no baja de 8:00.
    expect(clampDrag([], day, 4, 0, hours, at(8, 10))).toBe(2);
    expect(slotIsPast(day, 1, hours, at(8, 10))).toBe(true);
  });

  it("detecta el choque, pero 10 a 12 y 12 a 14 no se pisan", () => {
    const busy = [res("a", at(10), at(12)), res("p", at(15), at(16), "PENDIENTE")];
    expect(firstConflict(busy, at(12), at(14))).toBeNull();
    expect(firstConflict(busy, at(11), at(13))?.id).toBe("a");
    expect(firstConflict(busy, at(15, 30), at(17))?.id).toBe("p");
    expect(firstConflict([res("x", at(10), at(12), "FINALIZADA")], at(11), at(13))).toBeNull();
  });

  it("escribe los campos y la duración", () => {
    expect(toLocalInput(at(9, 5))).toBe("2026-11-10T09:05");
    expect(durationLabel(at(9), at(12))).toBe("3 h");
    expect(durationLabel(at(9), at(10, 30))).toBe("1 h 30 min");
    expect(durationLabel(at(9), at(9, 45))).toBe("45 min");
    expect(durationLabel(at(9), at(12, 0, 12))).toBe("2 días y 3 h");
  });
});

describe("textos cortos de los bloques", () => {
  it("dice la hora corta y si viene o sigue otro día", () => {
    expect(horaCorta(at(8))).toBe("8");
    expect(horaCorta(at(8, 30))).toBe("8:30");
    expect(blockTimeLabel(at(8), at(10, 30), false, false)).toBe("8 a 10:30 h");
    expect(blockTimeLabel(at(16), at(11, 0, 11), false, true)).toBe("Desde 16 h");
    expect(blockTimeLabel(at(16, 0, 9), at(11), true, false)).toBe("Hasta 11 h");
  });
});
