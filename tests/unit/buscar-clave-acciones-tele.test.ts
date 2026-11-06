import { describe, expect, it } from "vitest";
import {
  coincideBusqueda,
  condicionBusquedaSql,
  MAX_SEARCH_WORDS,
  normalizarBusqueda,
  palabrasDeBusqueda,
  patronesDeBusqueda,
} from "@/lib/search-text";
import {
  canRequestAgain,
  cleanHelpIdentifier,
  isHelpRequestVisible,
  PASSWORD_HELP_COOLDOWN_MS,
  PASSWORD_HELP_SHOW_MS,
  passwordHelpNotice,
} from "@/lib/password-help";
import {
  courseMeetsOn,
  courseStartMinutes,
  nextPanelIndex,
  reservationWhen,
  sortTodayItems,
  TV_PANELS,
  type TodayItem,
} from "@/lib/war-room-tv";

describe("103: buscar sin tildes ni orden", () => {
  it("pasa todo a mayúsculas sin tildes ni signos", () => {
    expect(normalizarBusqueda("Gómez, María")).toBe("GOMEZ MARIA");
    expect(normalizarBusqueda("  pérez-lópez   JUAN ")).toBe("PEREZ LOPEZ JUAN");
    expect(normalizarBusqueda("Núñez Ñandú")).toBe("NUNEZ NANDU");
    expect(normalizarBusqueda("Av. San Martín 1.234")).toBe("AV SAN MARTIN 1 234");
    expect(normalizarBusqueda(null)).toBe("");
  });

  it("encuentra en cualquier orden y sin tildes", () => {
    expect(coincideBusqueda("GÓMEZ, MARÍA", "maria gomez")).toBe(true);
    expect(coincideBusqueda("GÓMEZ, MARÍA", "gomez")).toBe(true);
    expect(coincideBusqueda("GÓMEZ, MARÍA", "Gómez Mar")).toBe(true);
    expect(coincideBusqueda("GÓMEZ, MARÍA", "maria lopez")).toBe(false);
    expect(coincideBusqueda("Sosa, Juan", "")).toBe(true);
  });

  it("no deja comodines ni más palabras de la cuenta", () => {
    expect(patronesDeBusqueda("100% _juan_")).toEqual(["%100%", "%JUAN%"]);
    expect(palabrasDeBusqueda("ana ana ANA")).toEqual(["ANA"]);
    expect(palabrasDeBusqueda("a b c d e f g h")).toHaveLength(MAX_SEARCH_WORDS);
  });

  it("arma la condición con parámetros numerados, nunca con el texto pegado", () => {
    const c = condicionBusquedaSql("texto_busqueda", "María Gómez'; DROP TABLE x", 3);
    expect(c.sql).toBe("(texto_busqueda LIKE $3 AND texto_busqueda LIKE $4 AND texto_busqueda LIKE $5 AND texto_busqueda LIKE $6 AND texto_busqueda LIKE $7)");
    expect(c.params).toEqual(["%MARIA%", "%GOMEZ%", "%DROP%", "%TABLE%", "%X%"]);
    expect(c.sql).not.toContain("DROP");
    expect(condicionBusquedaSql("texto_busqueda", " ,. ", 1)).toEqual({ sql: "TRUE", params: [] });
  });
});

describe("106: pedir clave temporal al ingresar", () => {
  const now = new Date("2026-11-06T15:00:00Z");

  it("limpia lo escrito", () => {
    expect(cleanHelpIdentifier("  maria.perez ")).toBe("maria.perez");
    expect(cleanHelpIdentifier("a")).toBe("");
    expect(cleanHelpIdentifier("x".repeat(121))).toBe("");
    expect(cleanHelpIdentifier(123)).toBe("");
  });

  it("una cuenta avisa como mucho una vez por hora", () => {
    expect(canRequestAgain(null, now)).toBe(true);
    expect(canRequestAgain(new Date(now.getTime() - 10 * 60 * 1000), now)).toBe(false);
    expect(canRequestAgain(new Date(now.getTime() - PASSWORD_HELP_COOLDOWN_MS), now)).toBe(true);
  });

  it("el pedido se muestra una semana", () => {
    expect(isHelpRequestVisible(null, now)).toBe(false);
    expect(isHelpRequestVisible(new Date(now.getTime() - 60_000), now)).toBe(true);
    expect(isHelpRequestVisible(new Date(now.getTime() - PASSWORD_HELP_SHOW_MS), now)).toBe(false);
  });

  it("el aviso dice quién y lleva a los pedidos en Usuarios", () => {
    const n = passwordHelpNotice({ name: "Ana Prueba", username: "ana.prueba" });
    expect(n.title).toBe("Ana Prueba pidió una clave temporal");
    expect(n.message).toContain("(usuario ana.prueba)");
    expect(n.link).toBe("/admin/users#pedidos-de-clave");
    expect(passwordHelpNotice({ username: "beto" }).title).toBe("beto pidió una clave temporal");
  });
});

describe("117: tele de la Sala de Situación", () => {
  it("las pantallas dan la vuelta para los dos lados", () => {
    expect(TV_PANELS.map((p) => p.id)).toEqual(["expedientes", "hoy"]);
    expect(nextPanelIndex(0)).toBe(1);
    expect(nextPanelIndex(1)).toBe(0);
    expect(nextPanelIndex(0, -1)).toBe(1);
    expect(nextPanelIndex(2, 1, 3)).toBe(0);
  });

  it("dice el horario de la reserva visto desde hoy", () => {
    const t = "2026-11-06";
    expect(reservationWhen(t, { day: t, time: "09:00" }, { day: t, time: "13:30" })).toEqual({ when: "09:00 a 13:30", sortMinutes: 540 });
    expect(reservationWhen(t, { day: t, time: "18:00" }, { day: "2026-11-07", time: "10:00" }).when).toBe("Desde las 18:00");
    expect(reservationWhen(t, { day: "2026-11-05", time: "18:00" }, { day: t, time: "10:00" }).when).toBe("Hasta las 10:00");
    expect(reservationWhen(t, { day: "2026-11-05", time: "18:00" }, { day: "2026-11-08", time: "10:00" }).when).toBe("Todo el día");
  });

  it("ordena lo de todo el día primero y después por hora", () => {
    const item = (id: string, sortMinutes: number): TodayItem => ({ id, kind: "vehiculo", when: "", sortMinutes, title: id, detail: null, pending: false });
    expect(sortTodayItems([item("b", 600), item("a", -1), item("c", 540)]).map((i) => i.id)).toEqual(["a", "c", "b"]);
    expect(sortTodayItems(Array.from({ length: 20 }, (_, i) => item(String(i), i)))).toHaveLength(12);
  });

  it("reconoce el día del curso en el horario", () => {
    // 2026-11-06 es viernes; 2026-11-04, miércoles; 2026-11-08, domingo.
    expect(courseMeetsOn("Lunes y miércoles de 18 a 20", "2026-11-04")).toBe(true);
    expect(courseMeetsOn("Lunes y miércoles de 18 a 20", "2026-11-06")).toBe(false);
    expect(courseMeetsOn("De lunes a viernes, 9 hs", "2026-11-06")).toBe(true);
    expect(courseMeetsOn("De lunes a viernes, 9 hs", "2026-11-08")).toBe(false);
    expect(courseMeetsOn(null, "2026-11-06")).toBe(false);
    expect(courseStartMinutes("Lunes y miércoles de 18 a 20")).toBe(18 * 60);
    expect(courseStartMinutes("Viernes 9:30 hs")).toBe(9 * 60 + 30);
    expect(courseStartMinutes("A convenir")).toBe(-1);
  });
});
