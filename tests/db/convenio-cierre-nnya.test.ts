import { beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { addDays, todayInArgentina } from "@/lib/follow-up-dates";
import { changeAgreementStatusAction, updateAgreementAction } from "@/app/(dashboard)/admin/actions/agreement-actions";
import {
  borrarHorasAction, cerrarPeriodoAction, configurarControlAction, guardarCuidadoraAction, guardarHorasAction, guardarValorHoraAction,
  reabrirPeriodoAction, registrarEgresoAction, repetirDiaAnteriorAction, vincularExpedienteAction, volvioAIngresarAction,
} from "@/app/(dashboard)/convenios/actions";
import { getAgreementHistory } from "@/services/convenio-ficha";
import { getConvenioControl, getResumenPeriodo } from "@/services/convenio-gasto";
import { getNnyaDelConvenio } from "@/services/convenio-nnya";
import { periodoDe } from "@/lib/convenio-gasto";
import { GET as rendicion } from "@/app/api/convenios/[id]/rendicion/route";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("convenios: editar, estado, cierre del período y NNyA", () => {
  const hoy = todayInArgentina();
  const ayer = addDays(hoy, -1);
  const anteayer = addDays(hoy, -2);
  const actual = periodoDe(hoy, 1);
  // El período de ayer (el actual, salvo el primer día del mes).
  const deAyer = periodoDe(ayer, 1);
  // Un día de hace dos períodos: ya terminado y lejos de ayer y anteayer.
  const diaViejo = addDays(actual.desde, -35);
  const anterior = periodoDe(diaViejo, 1);

  let ninez: Awaited<ReturnType<typeof createArea>>;
  let violencia: Awaited<ReturnType<typeof createArea>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let director: Awaited<ReturnType<typeof createUser>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let convenioId: string;
  let cuidadoraId: string;
  const nnyaA = "96100001";
  const nnyaB = "96100002";
  let casoA: string;

  const fila = (extra: Record<string, unknown>) => ({ cuidadoraId, horas: "8", lugar: "HOSPITAL", ...extra });
  const nnyaRow = (dni: string) => prisma.convenioNnya.findUniqueOrThrow({ where: { agreementId_dni: { agreementId: convenioId, dni } } });

  beforeAll(async () => {
    ninez = await createArea("Niñez (prueba cierre)");
    violencia = await createArea("Violencia de género (prueba cierre)");
    admin = await createUser("ADMIN_GENERAL");
    director = await createUser("DIRECTOR_AREA", ninez.id);
    operativo = await createUser("OPERATIVO", ninez.id);
    convenioId = (await prisma.agreement.create({ data: { title: "Cuidadoras (prueba cierre)", parties: "Municipio y Prueba", areaId: ninez.id } })).id;
    const a = await prisma.person.create({ data: { dni: nnyaA, firstName: "Nene", lastName: "Prueba" } });
    await prisma.person.create({ data: { dni: nnyaB, firstName: "Nena", lastName: "Prueba" } });
    casoA = (await prisma.case.create({ data: { personId: a.id, areaId: ninez.id, title: "Acompañamiento (prueba)" } })).id;
    await prisma.case.create({ data: { personId: a.id, areaId: violencia.id, title: "Reservado (prueba)", status: "CERRADO" } });

    loginAs(admin);
    const config = { monthlyCap: "5000000", periodStartDay: "1", alerta1: "70", alerta2: "85", alerta3: "95", valorHora: "10000", valorDesde: addDays(hoy, -90) };
    expect(await configurarControlAction(convenioId, config)).toEqual({ success: true });
    loginAs(operativo);
    expect(await guardarCuidadoraAction(convenioId, null, { nombre: "Ana Prueba" })).toEqual({ success: true });
    cuidadoraId = (await prisma.convenioCuidadora.findFirstOrThrow({ where: { agreementId: convenioId } })).id;
  });

  // -------------------------------------------------------------------------
  // 6: editar y cambiar el estado
  // -------------------------------------------------------------------------

  it("solo la conducción edita, y la historia anota qué cambió", async () => {
    const datos = { title: "Cuidadoras (prueba cierre)", parties: "Municipio y Prueba", number: "CONV-77", amount: "1500000", areaId: ninez.id };
    loginAs(operativo);
    expect((await updateAgreementAction(convenioId, datos)).success).toBe(false);
    loginAs(admin);
    expect(await updateAgreementAction(convenioId, datos)).toEqual({ success: true });
    expect(await updateAgreementAction(convenioId, datos)).toEqual({ success: false, error: "No cambiaste ningún dato." });
    const c = await prisma.agreement.findUniqueOrThrow({ where: { id: convenioId } });
    expect(c.number).toBe("CONV-77");
    expect(c.status).toBe("VIGENTE");
    const historia = await getAgreementHistory(convenioId);
    expect(historia[0].que).toBe("Editó un convenio");
    expect(historia[0].detalle).toContain("Número: vacío → CONV-77");
    expect(historia[0].detalle).toContain("Monto:");
  });

  it("cambiar el estado pide motivo; finalizado no deja cargar horas", async () => {
    loginAs(admin);
    expect((await changeAgreementStatusAction(convenioId, { status: "FINALIZADO", motivo: "" })).success).toBe(false);
    expect((await changeAgreementStatusAction(convenioId, { status: "VIGENTE", motivo: "Sigue igual" })).success).toBe(false);
    expect(await changeAgreementStatusAction(convenioId, { status: "FINALIZADO", motivo: "Terminó la emergencia" })).toEqual({ success: true });
    const historia = await getAgreementHistory(convenioId);
    expect(historia[0].que).toBe("Cambió el estado de un convenio");
    expect(historia[0].detalle).toBe("Estado: Vigente → Finalizado · Motivo: Terminó la emergencia");

    loginAs(operativo);
    const res = await guardarHorasAction(convenioId, null, fila({ fecha: ayer, dni: nnyaA }));
    expect(res.success).toBe(false);
    expect(!res.success && res.error).toContain("finalizado");

    loginAs(admin);
    expect(await changeAgreementStatusAction(convenioId, { status: "VIGENTE", motivo: "Se prorrogó" })).toEqual({ success: true });
  });

  // -------------------------------------------------------------------------
  // 19: cada NNyA
  // -------------------------------------------------------------------------

  it("al cargar horas el NNyA aparece con su ingreso y su único expediente abierto", async () => {
    loginAs(operativo);
    expect(await guardarHorasAction(convenioId, null, fila({ fecha: ayer, dni: nnyaA, horas: "10" }))).toEqual({ success: true });
    let a = await nnyaRow(nnyaA);
    expect(a.ingreso?.toISOString().slice(0, 10)).toBe(ayer);
    expect(a.caseId).toBe(casoA);
    // Una carga de un día anterior adelanta el ingreso.
    expect(await guardarHorasAction(convenioId, null, fila({ fecha: anteayer, dni: nnyaA, horas: "10" }))).toEqual({ success: true });
    a = await nnyaRow(nnyaA);
    expect(a.ingreso?.toISOString().slice(0, 10)).toBe(anteayer);

    expect(await guardarHorasAction(convenioId, null, fila({ fecha: ayer, dni: nnyaB, horas: "6" }))).toEqual({ success: true });
    expect((await nnyaRow(nnyaB)).caseId).toBeNull();
  });

  it("una fila cargada por error y borrada saca al NNyA de la lista", async () => {
    loginAs(operativo);
    await prisma.person.create({ data: { dni: "96100009", firstName: "Error", lastName: "Prueba" } });
    expect(await guardarHorasAction(convenioId, null, fila({ fecha: ayer, dni: "96100009", horas: "1" }))).toEqual({ success: true });
    const f = await prisma.convenioHora.findFirstOrThrow({ where: { agreementId: convenioId, dni: "96100009" } });
    expect(await borrarHorasAction(convenioId, f.id)).toEqual({ success: true });
    expect(await prisma.convenioNnya.count({ where: { agreementId: convenioId, dni: "96100009" } })).toBe(0);
  });

  it("el egreso no puede dejar horas después; con egreso no se cargan más ni cuenta para la proyección", async () => {
    const convenio = (await getConvenioControl(convenioId))!;
    const antes = await getResumenPeriodo(convenio, deAyer, hoy);
    expect(antes.horasBase).toBe(16);

    loginAs(operativo);
    const b = await nnyaRow(nnyaB);
    const mal = await registrarEgresoAction(convenioId, b.id, { fecha: anteayer });
    expect(mal.success).toBe(false);
    expect(await registrarEgresoAction(convenioId, b.id, { fecha: ayer, motivo: "Alta" })).toEqual({ success: true });

    const despues = await getResumenPeriodo(convenio, deAyer, hoy);
    expect(despues.horasBase).toBe(10);

    const otra = await guardarHorasAction(convenioId, null, fila({ fecha: hoy, dni: nnyaB }));
    expect(otra.success).toBe(false);
    expect(!otra.success && otra.error).toContain("egreso");

    // Repetir el día anterior saltea a quien egresó.
    const rep = await repetirDiaAnteriorAction(convenioId, hoy);
    expect(rep).toMatchObject({ success: true, copiadas: 1, salteadas: 1 });

    expect(await volvioAIngresarAction(convenioId, b.id)).toEqual({ success: true });
    expect(await guardarHorasAction(convenioId, null, fila({ fecha: hoy, dni: nnyaB }))).toEqual({ success: true });
  });

  it("el expediente se elige entre los del NNyA; los de violencia no se ven sin permiso", async () => {
    loginAs(operativo);
    const lista = await getNnyaDelConvenio(operativo, convenioId);
    const a = lista.find((n) => n.dni === nnyaA)!;
    expect(a.expediente?.id).toBe(casoA);
    expect(a.opciones.map((o) => o.title)).toEqual(["Acompañamiento (prueba)"]);
    const vg = await prisma.case.findFirstOrThrow({ where: { areaId: violencia.id } });
    expect((await vincularExpedienteAction(convenioId, a.id, vg.id)).success).toBe(false);
    const ajeno = await prisma.case.create({ data: { areaId: ninez.id, title: "De otra persona (prueba)" } });
    expect((await vincularExpedienteAction(convenioId, a.id, ajeno.id)).success).toBe(false);
    expect(await vincularExpedienteAction(convenioId, a.id, null)).toEqual({ success: true });
    expect((await nnyaRow(nnyaA)).caseId).toBeNull();
    expect(await vincularExpedienteAction(convenioId, a.id, casoA)).toEqual({ success: true });
  });

  // -------------------------------------------------------------------------
  // 21: cierre del período y rendición
  // -------------------------------------------------------------------------

  it("solo se cierra un período terminado, por la conducción o la dirección del área", async () => {
    loginAs(operativo);
    expect(await guardarHorasAction(convenioId, null, fila({ fecha: diaViejo, dni: nnyaA, horas: "12" }))).toEqual({ success: true });
    expect((await cerrarPeriodoAction(convenioId, anterior.desde)).success).toBe(false);
    loginAs(director);
    expect((await cerrarPeriodoAction(convenioId, actual.desde)).success).toBe(false);
    expect((await cerrarPeriodoAction(convenioId, addDays(anterior.desde, 1))).success).toBe(false);
    expect(await cerrarPeriodoAction(convenioId, anterior.desde)).toEqual({ success: true });
    expect((await cerrarPeriodoAction(convenioId, anterior.desde)).success).toBe(false);
    const cierre = await prisma.convenioPeriodoCerrado.findFirstOrThrow({ where: { agreementId: convenioId } });
    expect(Number(cierre.horas)).toBe(12);
    expect(Number(cierre.gastado)).toBe(120000);
  });

  it("cerrado, sus horas y su valor hora quedan fijos", async () => {
    loginAs(operativo);
    const nueva = await guardarHorasAction(convenioId, null, fila({ fecha: anterior.hasta, dni: nnyaA }));
    expect(nueva.success).toBe(false);
    expect(!nueva.success && nueva.error).toContain("cerrado");
    const vieja = await prisma.convenioHora.findFirstOrThrow({ where: { agreementId: convenioId, fecha: new Date(`${diaViejo}T00:00:00.000Z`) } });
    expect((await borrarHorasAction(convenioId, vieja.id)).success).toBe(false);
    expect((await guardarHorasAction(convenioId, vieja.id, fila({ fecha: diaViejo, dni: nnyaA, horas: "2" }))).success).toBe(false);
    // Mover una fila de un día abierto a uno cerrado tampoco.
    const deHoy = await prisma.convenioHora.findFirstOrThrow({ where: { agreementId: convenioId, fecha: new Date(`${hoy}T00:00:00.000Z`) } });
    expect((await guardarHorasAction(convenioId, deHoy.id, fila({ fecha: diaViejo, dni: deHoy.dni }))).success).toBe(false);

    loginAs(admin);
    const valor = await guardarValorHoraAction(convenioId, { desde: diaViejo, valor: "20000" });
    expect(valor.success).toBe(false);
    expect(await guardarValorHoraAction(convenioId, { desde: actual.desde, valor: "11000" })).toEqual({ success: true });
    const corte = await configurarControlAction(convenioId, { monthlyCap: "5000000", periodStartDay: "20", alerta1: "70", alerta2: "85", alerta3: "95" });
    expect(corte.success).toBe(false);
  });

  it("la rendición sale en Excel para quien puede bajar datos personales, y queda en Auditoría", async () => {
    loginAs(operativo);
    const req = (desde: string) => new Request(`http://localhost/api/convenios/${convenioId}/rendicion?periodo=${desde}`);
    const params = { params: Promise.resolve({ id: convenioId }) };
    expect((await rendicion(req(anterior.desde), params)).status).toBe(403);

    loginAs(director);
    const res = await rendicion(req(anterior.desde), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Resumen", "Por día", "Detalle", "Por cuidadora", "Por niño o niña"]);
    const resumen = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Resumen, { header: 1 });
    expect(resumen.find((r) => r[0] === "Estado del período")?.[1]).toContain("Cerrado el");
    expect(resumen.find((r) => r[0] === "Gastado ($)")?.[1]).toBe(120000);
    const detalle = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Detalle);
    expect(detalle).toHaveLength(1);
    expect(detalle[0]).toMatchObject({ "DNI del niño/a": nnyaA, Horas: 12, "Importe ($)": 120000, Lugar: "Hospital" });
    expect(await prisma.auditLog.count({ where: { action: "CONVENIO_RENDICION", entityId: convenioId } })).toBe(1);

    const parcial = await rendicion(req(actual.desde), params);
    const wb2 = XLSX.read(Buffer.from(await parcial.arrayBuffer()), { type: "buffer" });
    const resumen2 = XLSX.utils.sheet_to_json<string[]>(wb2.Sheets.Resumen, { header: 1 });
    expect(resumen2.find((r) => r[0] === "Estado del período")?.[1]).toContain("parcial");
  });

  it("reabrir es de la conducción y pide motivo; después se puede corregir", async () => {
    loginAs(director);
    expect((await reabrirPeriodoAction(convenioId, anterior.desde, "Faltaba un día")).success).toBe(false);
    loginAs(admin);
    expect((await reabrirPeriodoAction(convenioId, anterior.desde, "")).success).toBe(false);
    expect(await reabrirPeriodoAction(convenioId, anterior.desde, "Faltaba un día")).toEqual({ success: true });
    expect(await prisma.convenioPeriodoCerrado.count({ where: { agreementId: convenioId } })).toBe(0);
    loginAs(operativo);
    expect(await guardarHorasAction(convenioId, null, fila({ fecha: anterior.hasta, dni: nnyaA }))).toEqual({ success: true });
    const historia = await getAgreementHistory(convenioId);
    expect(historia.some((h) => h.que === "Reabrió un período de un convenio" && h.detalle.includes("Motivo: Faltaba un día"))).toBe(true);
  });
});
