import { describe, expect, it } from "vitest";
import { parseRecent, pushRecent, RECENT_MAX } from "@/lib/recent-views";
import { addDays, checkFollowUpDay, endOfTodayInArgentina, followUpDueDate, todayInArgentina } from "@/lib/follow-up-dates";

describe("vistos recientemente", () => {
  it("pone lo último adelante, sin repetir, y guarda pocos", () => {
    let list = pushRecent([], { kind: "case", id: "a" });
    list = pushRecent(list, { kind: "person", id: "a" });
    list = pushRecent(list, { kind: "case", id: "b" });
    list = pushRecent(list, { kind: "case", id: "a" });
    expect(list).toEqual([
      { kind: "case", id: "a" },
      { kind: "case", id: "b" },
      { kind: "person", id: "a" },
    ]);
    for (let i = 0; i < 20; i++) list = pushRecent(list, { kind: "case", id: `x${i}` });
    expect(list).toHaveLength(RECENT_MAX);
  });

  it("descarta lo guardado que no tiene la forma esperada", () => {
    expect(parseRecent("nada")).toEqual([]);
    expect(parseRecent([{ kind: "case", id: "ok" }, { kind: "otro", id: "x" }, { kind: "person" }, null, { kind: "person", id: "1".repeat(100) }])).toEqual([
      { kind: "case", id: "ok" },
    ]);
  });
});

describe("fechas de los seguimientos", () => {
  // 21/10 a las 23:30 en Argentina ya es 22/10 en UTC.
  const noche = new Date("2026-10-22T02:30:00Z");

  it("toma el día de Argentina, no el de UTC", () => {
    expect(todayInArgentina(noche)).toBe("2026-10-21");
    expect(endOfTodayInArgentina(noche).toISOString()).toBe("2026-10-22T03:00:00.000Z");
    expect(followUpDueDate("2026-10-28").toISOString()).toBe("2026-10-28T12:00:00.000Z");
    expect(addDays("2026-12-30", 7)).toBe("2027-01-06");
  });

  it("acepta de hoy hasta un año, y nada más", () => {
    expect(checkFollowUpDay("2026-10-21", noche)).toEqual({ ok: true, day: "2026-10-21" });
    expect(checkFollowUpDay("2026-10-20", noche).ok).toBe(false);
    expect(checkFollowUpDay("2028-01-01", noche).ok).toBe(false);
    expect(checkFollowUpDay("2026-02-30", noche).ok).toBe(false);
    expect(checkFollowUpDay("mañana", noche).ok).toBe(false);
  });
});
