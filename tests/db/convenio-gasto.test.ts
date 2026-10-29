import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { addDays, todayInArgentina } from "@/lib/follow-up-dates";
import {
  activarCuidadoraAction, borrarCuidadoraAction, borrarValorHoraAction, configurarControlAction, guardarCuidadoraAction, guardarHorasAction,
  guardarValorHoraAction, repetirDiaAnteriorAction,
} from "@/app/(dashboard)/convenios/actions";
import { getConveniosParaCargar, getResumenPeriodo, getConvenioControl } from "@/services/convenio-gasto";
import { periodoDe } from "@/lib/convenio-gasto";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("control del gasto de un convenio por horas", () => {
  const hoy = todayInArgentina();
  const ayer = addDays(hoy, -1);
  const anteayer = addDays(hoy, -2);
  let ninez: Awaited<ReturnType<typeof createArea>>;
  let otra: Awaited<ReturnType<typeof createArea>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let deOtraArea: Awaited<ReturnType<typeof createUser>>;
  let convenioId: string;
  let cuidadoraId: string;
  const nnya = "96000001";

  const horas = (extra: Record<string, unknown> = {}) => ({ fecha: anteayer, cuidadoraId, dni: nnya, horas: "24", lugar: "HOSPITAL", ...extra });

  beforeAll(async () => {
    ninez = await createArea("Niñez (prueba gasto)");
    otra = await createArea("Otra área (prueba gasto)");
    admin = await createUser("ADMIN_GENERAL");
    operativo = await createUser("OPERATIVO", ninez.id);
    deOtraArea = await createUser("OPERATIVO", otra.id);
    convenioId = (await prisma.agreement.create({ data: { title: "Cuidadoras (prueba)", parties: "Municipio y Prueba", areaId: ninez.id } })).id;
    await prisma.person.create({ data: { dni: nnya, firstName: "Nene", lastName: "Prueba" } });
  });

  it("solo la conducción lo configura, con tope, período y valor hora", async () => {
    const config = { monthlyCap: "1.000.000", periodStartDay: "20", alerta1: "70", alerta2: "85", alerta3: "95", valorHora: "10000", valorDesde: addDays(hoy, -40) };
    loginAs(operativo);
    expect((await configurarControlAction(convenioId, config)).success).toBe(false);
    loginAs(admin);
    expect(await configurarControlAction(convenioId, config)).toEqual({ success: true });
    const c = await prisma.agreement.findUniqueOrThrow({ where: { id: convenioId } });
    expect(c.costMode).toBe("POR_HORA");
    expect(Number(c.monthlyCap)).toBe(1000000);
    expect(c.alertPercents).toEqual([70, 85, 95]);
    expect(await prisma.convenioValorHora.count({ where: { agreementId: convenioId } })).toBe(1);
  });

  it("las cuidadoras las suma el área del convenio, sin repetir nombres", async () => {
    loginAs(deOtraArea);
    expect((await guardarCuidadoraAction(convenioId, null, { nombre: "Ana Prueba" })).success).toBe(false);
    loginAs(operativo);
    expect(await guardarCuidadoraAction(convenioId, null, { nombre: "Ana Prueba", dni: "30.111.222" })).toEqual({ success: true });
    expect((await guardarCuidadoraAction(convenioId, null, { nombre: "ana prueba" })).success).toBe(false);
    const c = await prisma.convenioCuidadora.findFirstOrThrow({ where: { agreementId: convenioId } });
    expect(c.dni).toBe("30111222");
    cuidadoraId = c.id;
  });

  it("carga horas de un NNyA del Registro Único y no deja pasar de 24 h en el día", async () => {
    loginAs(operativo);
    expect(await guardarHorasAction(convenioId, null, horas({ dni: "99999999" }))).toMatchObject({ success: false, error: expect.stringMatching(/padrón ni en el Registro Único/) });
    expect(await guardarHorasAction(convenioId, null, horas())).toEqual({ success: true });
    const fila = await prisma.convenioHora.findFirstOrThrow({ where: { agreementId: convenioId } });
    expect(fila.nombre).toBe("Prueba, Nene");
    expect(fila.fecha.toISOString()).toBe(`${anteayer}T00:00:00.000Z`);
    expect(await guardarHorasAction(convenioId, null, horas({ horas: "1" }))).toMatchObject({ success: false, error: expect.stringMatching(/pasaría de 24/) });
    expect((await guardarHorasAction(convenioId, null, horas({ fecha: addDays(hoy, 1) }))).success).toBe(false);
    expect(await guardarHorasAction(convenioId, null, horas({ fecha: addDays(hoy, -60) }))).toMatchObject({ success: false, error: expect.stringMatching(/valor hora/) });
  });

  it("repite el día anterior una sola vez", async () => {
    loginAs(operativo);
    expect(await repetirDiaAnteriorAction(convenioId, ayer)).toMatchObject({ success: true, copiadas: 1, salteadas: 0 });
    expect((await repetirDiaAnteriorAction(convenioId, ayer)).success).toBe(false);
    expect(await prisma.convenioHora.count({ where: { agreementId: convenioId, fecha: new Date(`${ayer}T00:00:00.000Z`) } })).toBe(1);
  });

  it("al corregir una fila queda quién la cambió, y Auditoría no puede cargar", async () => {
    const fila = await prisma.convenioHora.findFirstOrThrow({ where: { agreementId: convenioId, fecha: new Date(`${ayer}T00:00:00.000Z`) } });
    loginAs(await createUser("AUDITOR"));
    expect((await guardarHorasAction(convenioId, fila.id, horas({ fecha: ayer, horas: "12" }))).success).toBe(false);
    loginAs(admin);
    expect(await guardarHorasAction(convenioId, fila.id, horas({ fecha: ayer, horas: "12", lugar: "DISPOSITIVO" }))).toEqual({ success: true });
    const after = await prisma.convenioHora.findUniqueOrThrow({ where: { id: fila.id } });
    expect(Number(after.horas)).toBe(12);
    expect(after.updatedById).toBe(admin.id);
    expect(await prisma.auditLog.count({ where: { entityId: convenioId, action: "CONVENIO_HORAS_CAMBIO" } })).toBe(1);
  });

  it("calcula el período con el valor de cada día", async () => {
    loginAs(admin);
    // Aumento desde ayer: anteayer queda a $ 10.000 y ayer pasa a $ 12.000.
    expect(await guardarValorHoraAction(convenioId, { desde: ayer, valor: "12000" })).toEqual({ success: true });
    const convenio = (await getConvenioControl(convenioId))!;
    const periodo = periodoDe(hoy, 20);
    const r = await getResumenPeriodo(convenio, periodo, hoy);
    const esperado = (periodo.desde <= anteayer ? 24 * 10000 : 0) + (periodo.desde <= ayer ? 12 * 12000 : 0);
    expect(r.gastado).toBe(esperado);
    if (esperado > 0) expect(r.porCuidadora.map((c) => [c.nombre, c.importe])).toEqual([["Ana Prueba", esperado]]);
  });

  it("no borra un valor hora si deja horas sin valor", async () => {
    loginAs(admin);
    const primero = await prisma.convenioValorHora.findFirstOrThrow({ where: { agreementId: convenioId }, orderBy: { desde: "asc" } });
    expect(await borrarValorHoraAction(convenioId, primero.id)).toMatchObject({ success: false, error: expect.stringMatching(/sin valor hora/) });
  });

  it("una cuidadora con horas no se borra; de baja no se le cargan horas nuevas", async () => {
    loginAs(operativo);
    expect((await borrarCuidadoraAction(convenioId, cuidadoraId)).success).toBe(false);
    expect(await activarCuidadoraAction(convenioId, cuidadoraId, false)).toEqual({ success: true });
    expect(await guardarHorasAction(convenioId, null, horas({ fecha: hoy, horas: "2" }))).toMatchObject({ success: false, error: expect.stringMatching(/de baja/) });
    expect(await activarCuidadoraAction(convenioId, cuidadoraId, true)).toEqual({ success: true });
  });

  it("aparece en el inicio de quien carga en ese convenio", async () => {
    expect((await getConveniosParaCargar(operativo)).map((c) => c.id)).toEqual([convenioId]);
    expect(await getConveniosParaCargar(deOtraArea)).toEqual([]);
  });
});
