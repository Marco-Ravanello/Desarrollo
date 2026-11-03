import { describe, expect, it } from "vitest";
import { agregarFiltro, consultaDeFiltros, FILTROS_MAX, parseFiltros, quitarFiltro } from "@/lib/filtros-guardados";

describe("filtros guardados de Expedientes", () => {
  it("guarda solo los filtros, sin la página ni los 'todos'", () => {
    expect(consultaDeFiltros({ q: " pérez ", area: "all", status: "ACTIVOS", page: "4", quiet: "1", label: "" })).toBe(
      "q=p%C3%A9rez&status=ACTIVOS&quiet=1"
    );
    expect(consultaDeFiltros({ page: "2" })).toBe("");
    expect(consultaDeFiltros({ quiet: "0" })).toBe("");
  });

  it("agrega, reemplaza por nombre y respeta el máximo", () => {
    const a = agregarFiltro([], "Urgentes", "priority=URGENTE");
    expect(a.ok && a.filtros).toEqual([{ nombre: "Urgentes", consulta: "priority=URGENTE" }]);
    expect(agregarFiltro([], "  ", "priority=URGENTE").ok).toBe(false);
    expect(agregarFiltro([], "Sin nada", "page=3").ok).toBe(false);
    const llenos = Array.from({ length: FILTROS_MAX }, (_, i) => ({ nombre: `F${i}`, consulta: "status=ABIERTO" }));
    expect(agregarFiltro(llenos, "Otro", "status=CERRADO").ok).toBe(false);
    const reemplazo = agregarFiltro(llenos, "f0", "status=CERRADO");
    expect(reemplazo.ok && reemplazo.filtros.at(-1)).toEqual({ nombre: "f0", consulta: "status=CERRADO" });
  });

  it("lee lo guardado descartando lo roto o repetido, y borra sin importar mayúsculas", () => {
    expect(parseFiltros(null)).toEqual([]);
    expect(
      parseFiltros([{ nombre: "A", consulta: "status=ABIERTO" }, { nombre: "a", consulta: "status=CERRADO" }, { nombre: "", consulta: "q=x" }, 3, { nombre: "B", consulta: "page=1" }])
    ).toEqual([{ nombre: "A", consulta: "status=ABIERTO" }]);
    expect(quitarFiltro([{ nombre: "Urgentes", consulta: "priority=URGENTE" }], "urgentes")).toEqual([]);
  });
});
