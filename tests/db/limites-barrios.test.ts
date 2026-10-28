import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { deleteLimiteAction, saveLimiteAction } from "@/app/(dashboard)/barrios/actions";
import { getBarrioMapData, getPersonasFuera } from "@/services/barrios";
import { getLimite } from "@/services/barrio-limites";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const errorOf = (r: { success: true } | { success: false; error: string }) => (r.success ? null : r.error);
const all = { canViewSensitive: true };

// Un cuadrado chico alrededor de la estación Caseros.
const CUADRADO: [number, number][] = [
  [-34.600, -58.570],
  [-34.600, -58.555],
  [-34.613, -58.555],
  [-34.613, -58.570],
];

describe("límite de cada barrio en el mapa", () => {
  let admin: any;
  let operativo: any;

  beforeAll(async () => {
    admin = await createUser("ADMIN_GENERAL");
    operativo = await createUser("OPERATIVO");
    await prisma.padronUnificado.createMany({
      data: [
        // Dentro del contorno de OpenStreetMap de Caseros.
        { dni: "97400001", nombre_completo: "Límite, Ana", barrio: "Caseros", direccion: "Calle 10 100", latitude: -34.6066, longitude: -58.5634 },
        // Dice Caseros pero el punto cae en Ejército de los Andes.
        { dni: "97400002", nombre_completo: "Límite, Beto", barrio: "Caseros", direccion: "Calle 9 200", latitude: -34.6206, longitude: -58.5383 },
        { dni: "97400003", nombre_completo: "Límite, Ceci", barrio: "Caseros", direccion: "Calle 10 50", latitude: -34.6206, longitude: -58.5383 },
      ],
    });
  });

  it("marca en gris los puntos que caen afuera del contorno de OpenStreetMap", async () => {
    const d = await getBarrioMapData("Caseros", all);
    expect(d.limiteOrigen).toBe("OSM");
    expect(d.fuera).toBe(2);
    const flags = new Map(d.dnis.map((dni, i) => [dni, d.points[i * 3 + 2]]));
    expect(flags.get("97400001")! & 2).toBe(0);
    expect(flags.get("97400002")! & 2).toBe(2);
  });

  it("la lista dice dónde cae cada punto y ordena las alturas como números", async () => {
    const r = await getPersonasFuera("Caseros");
    expect(r.tieneLimite).toBe(true);
    expect(r.total).toBe(2);
    // "Calle 9" va antes que "Calle 10".
    expect(r.personas.map((p) => p.dni)).toEqual(["97400002", "97400003"]);
    expect(r.personas.every((p) => p.caeEn === "Ejército de los Andes")).toBe(true);
    expect((await getPersonasFuera("Evita")).tieneLimite).toBe(false);
  });

  it("solo la conducción dibuja; el dibujado le gana al de OpenStreetMap y al borrarlo vuelve", async () => {
    loginAs(operativo);
    expect(errorOf(await saveLimiteAction("Caseros", CUADRADO))).toMatch(/conducción/);
    loginAs(admin);
    expect(errorOf(await saveLimiteAction("Caseros", [[-34.6, -58.57], [-34.61, -58.56]]))).toMatch(/al menos 3/);
    expect(errorOf(await saveLimiteAction("Caseros", [[-35.5, -58.57], [-34.61, -58.56], [-34.6, -58.55]]))).toMatch(/fuera de Tres de Febrero/);
    expect(errorOf(await saveLimiteAction("No existe", CUADRADO))).toMatch(/No se encontró/);
    expect(errorOf(await saveLimiteAction("Caseros", CUADRADO))).toBeNull();

    const l = await getLimite("Caseros");
    expect(l?.origen).toBe("DIBUJADO");
    expect(l?.puntos).toHaveLength(4);
    expect((await getBarrioMapData("Caseros", all)).fuera).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "BARRIO_LIMITE", entityId: "Caseros" } })).toBe(1);

    loginAs(operativo);
    expect(errorOf(await deleteLimiteAction("Caseros"))).toMatch(/conducción/);
    loginAs(admin);
    expect(errorOf(await deleteLimiteAction("Caseros"))).toBeNull();
    expect((await getLimite("Caseros"))?.origen).toBe("OSM");
    expect(await prisma.auditLog.count({ where: { action: "BARRIO_LIMITE_BORRADO" } })).toBe(1);
  });

  it("un barrio sin contorno se puede dibujar desde cero", async () => {
    loginAs(admin);
    expect(await getLimite("Evita")).toBeNull();
    expect(errorOf(await saveLimiteAction("Evita", [...CUADRADO, CUADRADO[0]]))).toBeNull();
    // El punto que repite el primero se saca: el límite se cierra solo.
    expect((await getLimite("Evita"))?.puntos).toHaveLength(4);
  });
});
