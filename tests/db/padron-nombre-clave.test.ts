import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { nameKey } from "@/lib/padron-duplicates";

// Datos inventados, solo en la base de prueba local.
const NOMBRES = [
  "Gómez, Ana Prueba", "ANA PRUEBA GOMEZ", "Núñez  María del Carmen", "pérez-lópez juan", "O'Brien Ana", "Jörg Müller",
  "François Çelik", "SÃO JOÃO", "Ana", "Ana.", "  ", "", "Juan 2do Prueba", "de la Fuente, José", "ÁLVAREZ ÁNGEL",
];

describe("nombre comparable del padrón (posibles duplicados)", () => {
  it("la base lo calcula con la misma regla que nameKey", async () => {
    for (const [i, nombre] of NOMBRES.entries()) {
      const dni = String(97100000 + i);
      await prisma.padronUnificado.create({ data: { dni, nombre_completo: nombre } });
      const row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni } });
      // La base además deja afuera los nombres de tres letras o menos.
      const esperado = nombre.trim().length > 3 && nameKey(nombre) ? nameKey(nombre) : null;
      expect({ nombre, clave: row.nombre_clave }).toEqual({ nombre, clave: esperado });
    }
  });

  it("se actualiza al cambiar el nombre", async () => {
    await prisma.padronUnificado.update({ where: { dni: "97100000" }, data: { nombre_completo: "Sosa Prueba, Beto" } });
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97100000" } })).nombre_clave).toBe("BETO PRUEBA SOSA");
    await prisma.padronUnificado.update({ where: { dni: "97100000" }, data: { nombre_completo: null } });
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97100000" } })).nombre_clave).toBeNull();
    await prisma.padronUnificado.deleteMany({ where: { dni: { startsWith: "971" } } });
  });
});
