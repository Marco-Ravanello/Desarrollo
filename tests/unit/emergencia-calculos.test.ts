import { describe, expect, it } from "vitest";
import {
  cleanItemQuantities,
  deliveryStatus,
  findCategorySupply,
  pendingByCategory,
  pendingExtras,
  quantityText,
} from "@/lib/emergency-categories";
import type { StormVictimItem } from "@/types/emergency";

const ficha = (data: Partial<StormVictimItem>) => data as StormVictimItem;

describe("pendiente de entrega de una ficha", () => {
  it("resta lo entregado de lo pedido y nunca da negativo", () => {
    const r = ficha({ cantidadColchon: 3, entregadoColchon: 1, cantidadFrazada: 2, entregadoFrazada: 5 });
    expect(pendingByCategory(r)).toEqual({ COLCHON: 2, CAMA: 0, CUCHETA: 0, FRAZADA: 0 });
  });

  it("cuenta los otros insumos (chapas, nylon...)", () => {
    const r = ficha({ otrosElementos: { chapas: 4, nylon: 1 }, entregadoOtros: { chapas: 1, nylon: 1 } });
    expect(pendingExtras(r)).toEqual({ chapas: 3 });
  });

  it("calcula el estado de la entrega", () => {
    expect(deliveryStatus(ficha({}))).toBe("SIN_PEDIDO");
    expect(deliveryStatus(ficha({ cantidadCama: 1 }))).toBe("PENDIENTE");
    expect(deliveryStatus(ficha({ cantidadCama: 2, entregadoCama: 1 }))).toBe("PARCIAL");
    expect(deliveryStatus(ficha({ cantidadCama: 1, entregadoCama: 1 }))).toBe("ENTREGADO");
    // Falta solo un insumo agregado: sigue parcial.
    expect(deliveryStatus(ficha({ cantidadCama: 1, entregadoCama: 1, otrosElementos: { chapas: 2 } }))).toBe("PARCIAL");
    expect(
      deliveryStatus(ficha({ cantidadCama: 1, entregadoCama: 1, otrosElementos: { chapas: 2 }, entregadoOtros: { chapas: 2 } }))
    ).toBe("ENTREGADO");
  });
});

describe("cantidades de otros insumos", () => {
  it("deja solo enteros positivos y descarta lo que no es un objeto", () => {
    expect(cleanItemQuantities({ a: 2.7, b: 0, c: -1, d: "3", e: "x" })).toEqual({ a: 2, d: 3 });
    expect(cleanItemQuantities(null)).toEqual({});
    expect(cleanItemQuantities([1, 2])).toEqual({});
  });

  it("descarta insumos que no están en la lista permitida", () => {
    expect(cleanItemQuantities({ chapas: 2, inventado: 5 }, new Set(["chapas"]))).toEqual({ chapas: 2 });
  });
});

describe("insumo del depósito de cada elemento de las fichas", () => {
  const supplies = [
    { id: "s1", name: "Colchones de Contingencia (1 plaza)" },
    { id: "s2", name: "Frazadas" },
    { id: "s3", name: "Nombre corregido por alguien" },
  ];

  it("lo encuentra por nombre si no hay vínculo guardado", () => {
    expect(findCategorySupply(supplies, "COLCHON")?.id).toBe("s1");
    expect(findCategorySupply(supplies, "CAMA")).toBeUndefined();
  });

  it("usa el vínculo guardado aunque el insumo se haya renombrado", () => {
    expect(findCategorySupply(supplies, "COLCHON", { COLCHON: "s3" })?.id).toBe("s3");
  });

  it("no toma por nombre un insumo vinculado a otro elemento", () => {
    expect(findCategorySupply(supplies, "FRAZADA", { CAMA: "s2" })).toBeUndefined();
  });

  it("arma el texto en singular o plural", () => {
    expect(quantityText("COLCHON", 1)).toBe("1 colchón");
    expect(quantityText("COLCHON", 3)).toBe("3 colchones");
  });
});
