import { describe, expect, it } from "vitest";
import { daysText, parseSchedule, readHRForm, scheduleText } from "@/lib/hr-form";

const form = (o: Record<string, string>) => (k: string) => o[k] ?? null;
const base = { firstName: " Ana ", lastName: "Gómez", dni: "30.123.456", areaId: "a1", position: "Administrativa" };

describe("horario del legajo", () => {
  it("dice los días como se hablan", () => {
    expect(daysText([0, 1, 2, 3, 4])).toBe("Lunes a viernes");
    expect(daysText([4, 0, 2])).toBe("Lunes, miércoles y viernes");
    expect(daysText([5, 6])).toBe("Sábado y domingo");
    expect(daysText([2])).toBe("Miércoles");
    expect(daysText([])).toBe("");
  });

  it("arma y vuelve a leer el horario", () => {
    const t = scheduleText({ days: [0, 1, 2, 3, 4], from: "08:00", to: "14:30" });
    expect(t).toBe("Lunes a viernes, de 8 a 14:30 h");
    expect(parseSchedule(t)).toEqual({ days: [0, 1, 2, 3, 4], from: "08:00", to: "14:30" });
    expect(parseSchedule("Lunes, miércoles y viernes, de 9 a 13 h")?.days).toEqual([0, 2, 4]);
    // Lo escrito a mano no se toca.
    expect(parseSchedule("Guardias de 24 h")).toBeNull();
    expect(parseSchedule("8 a 14 h")).toBeNull();
  });
});

describe("lectura del formulario del legajo", () => {
  it("limpia los datos y deja en null lo vacío", () => {
    const r = readHRForm(form({ ...base, fileNumber: "  ", email: "Ana@Muni.gob.ar", birthDate: "1990-05-02", status: "ACTIVO", statusUntil: "2026-12-01" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.firstName).toBe("Ana");
    expect(r.data.dni).toBe("30123456");
    expect(r.data.fileNumber).toBeNull();
    expect(r.data.email).toBe("ana@muni.gob.ar");
    expect(r.data.birthDate?.toISOString()).toBe("1990-05-02T00:00:00.000Z");
    // "Hasta" solo vale para licencia o vacaciones.
    expect(r.data.statusUntil).toBeNull();
  });

  it("pide lo que falta con un mensaje claro", () => {
    expect(readHRForm(form({ ...base, dni: "123" }))).toEqual({ ok: false, error: "El DNI tiene que tener 7 u 8 números." });
    expect(readHRForm(form({ ...base, areaId: "" })).ok).toBe(false);
    expect(readHRForm(form({ ...base, email: "ana@" })).ok).toBe(false);
    expect(readHRForm(form({ ...base, phone: "1234" })).ok).toBe(false);
  });

  it("no guarda categoría para monotributistas y junta salud, estudios y licencia", () => {
    const r = readHRForm(form({ ...base, contractType: "MONOTRIBUTISTA", category: "12", salary: "450000.5", healthNotes: "Apto", tasks: "Atención" }));
    expect(r.ok && r.data.category).toBeNull();
    expect(r.ok && r.data.salary).toBe(450000.5);
    expect(r.ok && JSON.parse(r.data.tasks)).toEqual({ tasksText: "Atención", healthNotes: "Apto", education: "", drivingLicense: "" });
  });
});
