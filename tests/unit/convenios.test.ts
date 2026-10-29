import { describe, expect, it } from "vitest";
import {
  agreementState, canCreateAgreements, describeAgreementChanges, isAgreementClosed, parseAgreementInput, parseStatusChange,
} from "@/lib/convenios";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = "2026-10-29";

describe("estado de un convenio", () => {
  it("en castellano, y un vigente con la fecha de fin pasada se muestra vencido", () => {
    expect(agreementState({ status: "VIGENTE", endDate: day("2027-12-31") }, HOY)).toMatchObject({
      status: "VIGENTE", label: "Vigente", tone: "green", endLabel: "Hasta el 31/12/2027", soon: false,
    });
    expect(agreementState({ status: "VIGENTE", endDate: day("2026-03-03") }, HOY)).toMatchObject({
      status: "VENCIDO", label: "Vencido", tone: "rose", endLabel: "Venció el 03/03/2026", endTone: "rose",
    });
    expect(agreementState({ status: "EN_REVISION", endDate: null }, HOY)).toMatchObject({ label: "En revisión", tone: "blue", endLabel: null });
  });

  it("avisa cuando faltan 60 días o menos", () => {
    expect(agreementState({ status: "VIGENTE", endDate: day("2026-11-18") }, HOY)).toMatchObject({
      tone: "amber", endLabel: "Vence en 20 días", endTone: "amber", soon: true,
    });
    expect(agreementState({ status: "VIGENTE", endDate: day("2026-10-29") }, HOY).endLabel).toBe("Vence hoy");
    expect(agreementState({ status: "VIGENTE", endDate: day("2026-10-30") }, HOY).endLabel).toBe("Vence mañana");
    expect(agreementState({ status: "VIGENTE", endDate: day("2026-12-29") }, HOY).soon).toBe(false);
  });

  it("los terminados no avisan nada", () => {
    expect(agreementState({ status: "FINALIZADO", endDate: day("2026-11-01") }, HOY)).toMatchObject({
      status: "FINALIZADO", label: "Finalizado", tone: "gray", endLabel: "Hasta el 01/11/2026", soon: false,
    });
    expect(agreementState({ status: "RESCINDIDO", endDate: day("2026-01-01") }, HOY)).toMatchObject({ label: "Rescindido", endTone: "gray" });
  });
});

describe("formulario de convenio", () => {
  const base = { title: "Convenio con Provincia", parties: "Municipio y Ministerio", status: "VIGENTE" };

  it("dice qué falta", () => {
    expect(parseAgreementInput({ ...base, title: " " })).toEqual({ ok: false, error: "Escribí el título o el objeto del convenio." });
    expect(parseAgreementInput({ ...base, parties: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/con quién se firma/) });
    expect(parseAgreementInput({ ...base, amount: "-5" })).toMatchObject({ ok: false, error: expect.stringMatching(/monto/) });
    expect(parseAgreementInput({ ...base, startDate: "2026-11-01", endDate: "2026-10-01" })).toMatchObject({ ok: false, error: expect.stringMatching(/anterior/) });
    expect(parseAgreementInput({ ...base, endDate: "2026-02-30" })).toMatchObject({ ok: false, error: expect.stringMatching(/fechas/) });
    expect(parseAgreementInput({ ...base, status: "VENCIDO" })).toMatchObject({ ok: false, error: expect.stringMatching(/vigente o en revisión/) });
  });

  it("el número, el monto, el área y las fechas son opcionales", () => {
    expect(parseAgreementInput({ ...base, number: "  ", amount: "", areaId: "", description: "" })).toEqual({
      ok: true,
      data: { ...base, number: null, amount: null, areaId: null, description: null, startDate: null, endDate: null, status: "VIGENTE" },
    });
    const r = parseAgreementInput({ ...base, number: " CONV-12 ", amount: "1500000.5", status: "EN_REVISION", startDate: "2026-01-01" });
    expect(r.ok && r.data).toMatchObject({ number: "CONV-12", amount: 1500000.5, status: "EN_REVISION", startDate: "2026-01-01" });
  });

  it("los cargan solo Superadmin, Administración General y Dirección General", () => {
    expect(["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"].every(canCreateAgreements)).toBe(true);
    expect(canCreateAgreements("DIRECTOR_AREA")).toBe(false);
    expect(canCreateAgreements("AUDITOR")).toBe(false);
  });
});

describe("editar y cambiar el estado", () => {
  it("al editar, el estado no se toma del formulario", () => {
    const r = parseAgreementInput({ title: "Convenio", parties: "Municipio y Club", status: "FINALIZADO" }, { withStatus: false });
    expect(r.ok).toBe(true);
  });

  it("el estado nuevo tiene que ser otro y lleva motivo", () => {
    expect(parseStatusChange({ status: "FINALIZADO", motivo: "  Terminó   la emergencia " }, "VIGENTE")).toEqual({
      ok: true,
      data: { status: "FINALIZADO", motivo: "Terminó la emergencia" },
    });
    expect(parseStatusChange({ status: "VIGENTE", motivo: "Igual" }, "VIGENTE").ok).toBe(false);
    expect(parseStatusChange({ status: "VENCIDO", motivo: "Venció" }, "VIGENTE").ok).toBe(false);
    expect(parseStatusChange({ status: "RESCINDIDO", motivo: "" }, "VIGENTE").ok).toBe(false);
  });

  it("finalizado y rescindido cierran la carga", () => {
    expect(isAgreementClosed("FINALIZADO")).toBe(true);
    expect(isAgreementClosed("RESCINDIDO")).toBe(true);
    expect(isAgreementClosed("VIGENTE")).toBe(false);
    expect(isAgreementClosed("EN_REVISION")).toBe(false);
  });

  it("la historia dice qué cambió, en castellano", () => {
    const base = {
      title: "Cuidadoras", number: null, parties: "Municipio", description: null, amount: 1000,
      startDate: "2026-01-01", endDate: null, areaName: "Niñez",
    };
    expect(describeAgreementChanges(base, { ...base })).toEqual([]);
    expect(describeAgreementChanges(base, { ...base, number: "CONV-1", amount: 2000, endDate: "2026-12-31" })).toEqual([
      "Número: vacío → CONV-1",
      `Monto: $ ${(1000).toLocaleString("es-AR")} → $ ${(2000).toLocaleString("es-AR")}`,
      "Vencimiento: vacío → 31/12/2026",
    ]);
  });
});
