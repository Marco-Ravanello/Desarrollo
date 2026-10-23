import { describe, expect, it } from "vitest";
import { fechaIsoATexto, parseFechaNacimiento, splitNombreCompleto } from "@/lib/person-display";
import { mergeOptions } from "@/lib/localidades";
import { allowedOrderTransitions, canChangeOrderStatus, orderStatusLabel, translateOrderStatuses } from "@/lib/purchase-orders";
import { canChangeReservation, formatReservationRange, rangesOverlap, reservationActionsFor } from "@/lib/vehicle-reservations";

describe("datos de la persona", () => {
  it("separa apellido y nombre como vienen en el padrón", () => {
    expect(splitNombreCompleto("PÉREZ, JUAN CARLOS")).toEqual({ lastName: "PÉREZ", firstName: "JUAN CARLOS" });
    expect(splitNombreCompleto("PÉREZ JUAN CARLOS")).toEqual({ lastName: "PÉREZ", firstName: "JUAN CARLOS" });
    expect(splitNombreCompleto(null)).toEqual({ lastName: "", firstName: "" });
  });

  it("entiende las fechas de nacimiento escritas de distintas formas", () => {
    expect(parseFechaNacimiento("05/03/1980")).toBe("1980-03-05");
    expect(parseFechaNacimiento("5-3-1980")).toBe("1980-03-05");
    expect(parseFechaNacimiento("1980-03-05T00:00:00")).toBe("1980-03-05");
    expect(parseFechaNacimiento("31/02/1980")).toBeNull();
    expect(parseFechaNacimiento("1980")).toBeNull();
    expect(fechaIsoATexto("1980-03-05")).toBe("05/03/1980");
  });

  it("junta localidades sin repetir por tildes o mayúsculas", () => {
    expect(mergeOptions(["Sáenz Peña", "Caseros"], ["saenz peña", "CASEROS", "Tres de Febrero", " "])).toEqual(["Caseros", "Sáenz Peña", "Tres de Febrero"]);
  });
});

describe("órdenes de compra", () => {
  it("Auditoría no tiene botones; aprobar y rechazar es de Superadmin y Administración General", () => {
    expect(allowedOrderTransitions("AUDITOR", "PENDIENTE_APROBACION")).toEqual([]);
    expect(allowedOrderTransitions("AUDITOR", "BORRADOR")).toEqual([]);
    expect(allowedOrderTransitions("DIRECTOR_AREA", "PENDIENTE_APROBACION")).toEqual([]);
    expect(allowedOrderTransitions("ADMIN_GENERAL", "PENDIENTE_APROBACION")).toEqual(["APROBADA", "RECHAZADA", "BORRADOR", "CANCELADA"]);
    expect(canChangeOrderStatus("SUPERADMIN", "PENDIENTE_APROBACION", "RECHAZADA")).toBe(true);
    expect(canChangeOrderStatus("DIRECCION_GENERAL", "PENDIENTE_APROBACION", "APROBADA")).toBe(false);
  });

  it("quien carga órdenes las envía a firma y corrige las rechazadas", () => {
    expect(allowedOrderTransitions("DIRECTOR_AREA", "BORRADOR")).toEqual(["PENDIENTE_APROBACION", "CANCELADA"]);
    expect(allowedOrderTransitions("DIRECTOR_AREA", "RECHAZADA")).toEqual(["BORRADOR"]);
    expect(canChangeOrderStatus("SUPERADMIN", "APROBADA", "CUMPLIDA")).toBe(false);
  });

  it("muestra los estados en castellano, también en la actividad vieja", () => {
    expect(orderStatusLabel("PENDIENTE_APROBACION")).toBe("Pendiente de aprobación");
    expect(translateOrderStatuses("Estado cambiado de PENDIENTE_APROBACION a RECHAZADA.")).toBe("Estado cambiado de Pendiente de aprobación a Rechazada.");
  });
});

describe("reservas de vehículos", () => {
  const d = (h: number) => new Date(Date.UTC(2030, 9, 27, h + 3));

  it("un horario pisa a otro solo si se superponen de verdad", () => {
    expect(rangesOverlap(d(10), d(12), d(11), d(13))).toBe(true);
    expect(rangesOverlap(d(10), d(12), d(12), d(14))).toBe(false);
    expect(rangesOverlap(d(10), d(14), d(11), d(12))).toBe(true);
  });

  it("muestra el horario en hora argentina y en 24 horas", () => {
    expect(formatReservationRange(d(10), d(12))).toBe("27/10/2030 de 10:00 a 12:00");
    expect(formatReservationRange(d(22), d(26))).toBe("27/10/2030 22:00 al 28/10/2030 02:00");
  });

  it("cada persona ve solo los botones que puede usar", () => {
    const pedida = { userId: "u1", status: "PENDIENTE" as const };
    const aprobada = { userId: "u1", status: "APROBADA" as const };
    expect(reservationActionsFor({ id: "u1", role: "OPERATIVO" }, pedida)).toEqual(["CANCELADA"]);
    expect(reservationActionsFor({ id: "u2", role: "OPERATIVO" }, aprobada)).toEqual([]);
    expect(reservationActionsFor({ id: "u2", role: "ADMIN_GENERAL" }, pedida)).toEqual(["APROBADA", "RECHAZADA", "CANCELADA"]);
    expect(reservationActionsFor({ id: "u2", role: "SUPERADMIN" }, aprobada)).toEqual(["EN_CURSO", "CANCELADA"]);
    expect(canChangeReservation({ id: "u1", role: "OPERATIVO" }, { userId: "u1", status: "EN_CURSO" }, "FINALIZADA")).toBe(false);
    expect(canChangeReservation({ id: "x", role: "DIRECTOR_AREA" }, pedida, "APROBADA")).toBe(false);
  });
});
