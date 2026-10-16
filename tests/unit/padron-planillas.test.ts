import { describe, expect, it } from "vitest";
import {
  buildPadronRecords,
  findHeaderRow,
  formatSheetDate,
  guessMapping,
  normalizeDni,
  sanitizeRecords,
} from "@/lib/padron-import";

// Encabezados como los de distintas planillas reales de programas (datos inventados).
describe("reconocer las columnas de una planilla", () => {
  it("planilla con apellido y nombre juntos", () => {
    const m = guessMapping(["Nº", "Apellido y Nombre", "D.N.I.", "Domicilio", "Barrio", "Tel/Cel", "Fecha Nac."]);
    expect(m).toMatchObject({ nombreCompleto: 1, dni: 2, direccion: 3, barrio: 4, telefono: 5, fechaNacimiento: 6 });
    expect(m.apellido).toBeUndefined();
    expect(m.nombre).toBeUndefined();
  });

  it("planilla con apellido y nombre separados y otros nombres de columna", () => {
    const m = guessMapping(["APELLIDOS", "NOMBRES", "NRO DE DOCUMENTO", "CALLE", "LOCALIDAD", "CORREO ELECTRÓNICO", "SEXO", "Condición"]);
    expect(m).toMatchObject({ apellido: 0, nombre: 1, dni: 2, direccion: 3, localidad: 4, email: 5, genero: 6, rol: 7 });
  });

  it("toma el CUIL como DNI si no hay columna de DNI", () => {
    expect(guessMapping(["Titular", "CUIL"]).dni).toBe(1);
  });

  it("no asigna la misma columna a dos datos", () => {
    const m = guessMapping(["DNI", "Nombre"]);
    expect(m).toEqual({ dni: 0, nombre: 1 });
  });

  it("encuentra la fila de encabezados aunque arriba haya un título", () => {
    const matrix = [["PROGRAMA ENVIÓN - LISTADO 2026"], [], ["Apellido y nombre", "DNI"], ["Pérez, Juana", "30123456"]];
    expect(findHeaderRow(matrix)).toBe(2);
  });
});

describe("leer las filas", () => {
  it("normaliza el DNI: puntos, ceros adelante y CUIL", () => {
    expect(normalizeDni("30.123.456")).toBe("30123456");
    expect(normalizeDni(30123456)).toBe("30123456");
    expect(normalizeDni("27-30123456-4")).toBe("30123456");
    expect(normalizeDni("08123456")).toBe("8123456");
    expect(normalizeDni("123")).toBeNull();
    expect(normalizeDni("")).toBeNull();
  });

  it("convierte fechas de Excel y de texto a dd/mm/aaaa", () => {
    expect(formatSheetDate(33604)).toBe("01/01/1992");
    expect(formatSheetDate("1/2/1990")).toBe("01/02/1990");
    expect(formatSheetDate("1990-02-01")).toBe("01/02/1990");
    expect(formatSheetDate("sin dato")).toBe("sin dato");
  });

  it("arma las personas, informa errores y DNI repetidos, y saltea filas vacías", () => {
    const matrix = [
      ["Apellido", "Nombre", "DNI", "Mail"],
      ["Pérez", "Juana", "30.123.456", "JUANA@EJEMPLO.COM"],
      ["", "", "", ""],
      ["Gómez", "Ana", "", ""],
      ["Ruiz", "Luis", "abc", ""],
      ["Pérez", "Juana", "30123456", ""],
      ["Sosa", "", 40111222, "no-es-un-mail"],
    ];
    const { records, errors, warnings } = buildPadronRecords(matrix, 0, guessMapping(matrix[0]));
    expect(records).toEqual([
      { row: 2, dni: "30123456", nombreCompleto: "Pérez, Juana", email: "juana@ejemplo.com" },
      { row: 7, dni: "40111222", nombreCompleto: "Sosa" },
    ]);
    expect(errors).toEqual([
      { row: 4, message: "falta el DNI" },
      { row: 5, message: 'el DNI "abc" no es válido' },
    ]);
    expect(warnings).toEqual([{ row: 6, message: "el DNI 30123456 se repite (ya está en la fila 2); se usa esa fila" }]);
  });

  it("en el servidor vuelve a limpiar lo que llega del navegador", () => {
    const clean = sanitizeRecords([{ dni: "30.123.456", nombreCompleto: "  Pérez,   Juana ", extra: "x", email: "mal" }, { dni: "1" }, null]);
    expect(clean).toEqual([{ row: 0, dni: "30123456", nombreCompleto: "Pérez, Juana" }]);
  });
});
