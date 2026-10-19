import { describe, expect, it } from "vitest";
import { addressKey, birthKey, dniLooksMistyped, duplicateSignals, nameKey, pairKey } from "@/lib/padron-duplicates";
import { idleStateAt } from "@/lib/inactivity";

describe("posibles duplicados del padrón", () => {
  it("compara nombres sin tildes, signos ni orden de las palabras", () => {
    expect(nameKey("Pérez, Juan Carlos")).toBe(nameKey("JUAN CARLOS PEREZ"));
    expect(nameKey("Núñez María")).toBe("MARIA NUNEZ");
    expect(nameKey("Juan")).toBe("");
  });

  it("reconoce un DNI mal tipeado", () => {
    expect(dniLooksMistyped("30123456", "30123457")).toBe(true); // un número distinto
    expect(dniLooksMistyped("30123456", "30523496")).toBe(false); // dos números lejanos
    expect(dniLooksMistyped("30123456", "30132456")).toBe(true); // dos vecinos invertidos
    expect(dniLooksMistyped("30123456", "3012456")).toBe(true); // falta un número
    expect(dniLooksMistyped("30.123.456", "30123456")).toBe(false); // es el mismo
    expect(dniLooksMistyped("30123456", "41987654")).toBe(false);
  });

  it("domicilios y fechas comparables, y descarta los vacíos", () => {
    expect(addressKey("Av. San Martín N° 1234")).toBe(addressKey("AV SAN MARTIN 1234"));
    expect(addressKey("S/D")).toBe("");
    expect(addressKey("Barrio Libertador")).toBe("");
    expect(birthKey("01/02/1990")).toBe("01021990");
    expect(birthKey("")).toBe("");
  });

  it("mismo nombre solo no alcanza: tiene que haber otro motivo", () => {
    const base = { nombre_completo: "PEREZ JUAN", direccion: null, fecha_nacimiento: null };
    expect(duplicateSignals({ ...base, dni: "30123456" }, { ...base, dni: "27999888" })).toEqual([]);
    expect(
      duplicateSignals(
        { ...base, dni: "30123456", direccion: "Mitre 100", fecha_nacimiento: "01/02/1990" },
        { ...base, dni: "30123457", direccion: "MITRE 100", fecha_nacimiento: "01/02/1990" }
      )
    ).toEqual(["DNI_PARECIDO", "MISMA_FECHA_NACIMIENTO", "MISMO_DOMICILIO"]);
    expect(pairKey("2", "1")).toEqual(["1", "2"]);
  });
});

describe("cierre de sesión por inactividad", () => {
  const limit = 30 * 60 * 1000;
  const warning = 60 * 1000;
  it("avisa en el último minuto y cierra al llegar al límite", () => {
    expect(idleStateAt(10 * 60 * 1000, 0, limit, warning)).toMatchObject({ expired: false, warning: false });
    expect(idleStateAt(limit - 30 * 1000, 0, limit, warning)).toMatchObject({ expired: false, warning: true, remainingMs: 30 * 1000 });
    expect(idleStateAt(limit, 0, limit, warning)).toMatchObject({ expired: true, warning: false });
    expect(idleStateAt(limit * 10, 0, limit, warning).expired).toBe(true);
  });
});
