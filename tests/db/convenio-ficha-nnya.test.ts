import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { addDays, todayInArgentina } from "@/lib/follow-up-dates";
import {
  borrarHorasAction,
  buscarEnRegistroAction,
  configurarControlAction,
  guardarFichaNnyaAction,
  guardarHorasAction,
  sacarNnyaAction,
  sumarNnyaAction,
} from "@/app/(dashboard)/convenios/actions";
import { getNnyaDelConvenio } from "@/services/convenio-nnya";
import { getNnyaParaCargar } from "@/services/convenio-gasto";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("convenios: sumar niños y niñas desde el Registro Único y su ficha", () => {
  const hoy = todayInArgentina();
  const ayer = addDays(hoy, -1);

  let area: Awaited<ReturnType<typeof createArea>>;
  let otraArea: Awaited<ReturnType<typeof createArea>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let deOtraArea: Awaited<ReturnType<typeof createUser>>;
  let convenioId: string;
  const enPadron = "96200001";
  const enRegistro = "96200002";
  const nuevo = "96200003";

  const row = (dni: string) => prisma.convenioNnya.findUnique({ where: { agreementId_dni: { agreementId: convenioId, dni } } });
  const ultimaAuditoria = (action: string) =>
    prisma.auditLog.findFirstOrThrow({ where: { action, entityId: convenioId }, orderBy: { createdAt: "desc" } });

  beforeAll(async () => {
    area = await createArea("Niñez (prueba ficha)");
    otraArea = await createArea("Deportes (prueba ficha)");
    admin = await createUser("ADMIN_GENERAL");
    operativo = await createUser("OPERATIVO", area.id);
    deOtraArea = await createUser("OPERATIVO", otraArea.id);
    convenioId = (
      await prisma.agreement.create({ data: { title: "Cuidadoras (prueba ficha)", parties: "Municipio y Prueba", areaId: area.id } })
    ).id;
    await prisma.padronUnificado.create({
      data: {
        dni: enPadron,
        nombre_completo: "Fichaprueba, Tomás",
        fecha_nacimiento: "03/05/2015",
        genero: "Masculino",
        cantidad_programas: 0,
      },
    });
    await prisma.person.create({ data: { dni: enRegistro, firstName: "Lola", lastName: "Fichaprueba" } });
    loginAs(admin);
    const config = {
      monthlyCap: "5000000",
      periodStartDay: "1",
      alerta1: "70",
      alerta2: "85",
      alerta3: "95",
      valorHora: "10000",
      valorDesde: addDays(hoy, -90),
    };
    expect(await configurarControlAction(convenioId, config)).toEqual({ success: true });
  });

  it("busca en el padrón y en el Registro Único por DNI o apellido, solo para quien carga en el convenio", async () => {
    loginAs(operativo);
    const porApellido = await buscarEnRegistroAction(convenioId, "fichaprueba");
    expect(porApellido.map((r) => r.dni).sort()).toEqual([enPadron, enRegistro]);
    const tomas = porApellido.find((r) => r.dni === enPadron)!;
    expect(tomas.nombre).toBe("Fichaprueba, Tomás");
    expect(tomas.edad).toBeGreaterThanOrEqual(10);
    expect(tomas.enConvenio).toBe(false);
    expect((await buscarEnRegistroAction(convenioId, "96.200.002")).map((r) => r.dni)).toEqual([enRegistro]);
    expect(await buscarEnRegistroAction(convenioId, "fi")).toEqual([]);

    loginAs(deOtraArea);
    expect(await buscarEnRegistroAction(convenioId, "fichaprueba")).toEqual([]);
  });

  it("suma a alguien del padrón antes de tener horas, con los datos del convenio", async () => {
    loginAs(operativo);
    const res = await sumarNnyaAction(convenioId, {
      dni: enPadron,
      interviene: "  Juzgado de Familia N° 9 (prueba) ",
      motivo: "Medida de abrigo (prueba)",
      obraSocial: "",
    });
    expect(res).toEqual({ success: true, dni: enPadron, nombre: "Fichaprueba, Tomás" });
    const r = await row(enPadron);
    expect(r?.ingreso).toBeNull();
    expect(r?.createdById).toBe(operativo.id);
    expect(r?.nombre).toBe("Fichaprueba, Tomás");
    expect(r?.interviene).toBe("Juzgado de Familia N° 9 (prueba)");
    expect(r?.obraSocial).toBeNull();

    expect(await sumarNnyaAction(convenioId, { dni: enPadron })).toEqual({
      success: false,
      error: "Ya está en la lista de este convenio.",
    });
    expect((await buscarEnRegistroAction(convenioId, enPadron))[0].enConvenio).toBe(true);
    const audit = await ultimaAuditoria("CONVENIO_NNYA_ALTA");
    expect(JSON.parse(audit.details!)).toEqual({ dni: enPadron, registro: "Ya estaba" });

    const lista = await getNnyaDelConvenio(operativo, convenioId);
    const tomas = lista.find((n) => n.dni === enPadron)!;
    expect(tomas.ingreso).toBeNull();
    expect(tomas.datos.fechaNacimiento).toBe("2015-05-03");
    expect(tomas.datos.genero).toBe("Masculino");
    expect(tomas.motivo).toBe("Medida de abrigo (prueba)");
    // Aparece para elegir al cargar horas.
    expect((await getNnyaParaCargar(convenioId)).map((n) => n.dni)).toContain(enPadron);
  });

  it("si no está, pide los datos y lo carga en el Registro Único y el padrón", async () => {
    loginAs(operativo);
    const sinDatos = await sumarNnyaAction(convenioId, { dni: nuevo });
    expect(sinDatos.success).toBe(false);
    expect(!sinDatos.success && sinDatos.error).toContain("Completá sus datos");
    // Si ya estaba, no se pisan sus datos.
    const yaEsta = await sumarNnyaAction(convenioId, { dni: enRegistro, nuevo: "1", lastName: "Otro", firstName: "Nombre" });
    expect(yaEsta).toEqual({ success: false, error: "Ese DNI ya está en el Registro Único como Fichaprueba, Lola. Volvé a buscar y elegilo." });
    expect((await prisma.person.findUniqueOrThrow({ where: { dni: enRegistro } })).firstName).toBe("Lola");
    const sinNombre = await sumarNnyaAction(convenioId, { dni: nuevo, nuevo: "1", lastName: "Nuevaprueba" });
    expect(sinNombre).toEqual({ success: false, error: "Completá el nombre y el apellido." });

    const res = await sumarNnyaAction(convenioId, {
      dni: "96.200.003",
      nuevo: "1",
      lastName: "Nuevaprueba",
      firstName: "Sofía",
      fechaNacimiento: "2012-08-20",
      genero: "Femenino",
      direccion: "Calle Inventada 123",
      localidad: "Caseros",
      motivo: "Ingreso por oficio (prueba)",
    });
    expect(res).toEqual({ success: true, dni: nuevo, nombre: "Nuevaprueba, Sofía" });
    const persona = await prisma.person.findUniqueOrThrow({ where: { dni: nuevo } });
    expect(persona.firstName).toBe("Sofía");
    const padron = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: nuevo } });
    expect(padron.nombre_completo).toBe("Nuevaprueba, Sofía");
    expect(padron.localidad).toBe("Caseros");
    expect((await row(nuevo))?.motivo).toBe("Ingreso por oficio (prueba)");
    expect(JSON.parse((await ultimaAuditoria("CONVENIO_NNYA_ALTA")).details!).registro).toBe("Lo cargaron desde el convenio");
  });

  it("los datos del convenio se corrigen y Auditoría anota qué cambió, sin el contenido", async () => {
    loginAs(operativo);
    const r = (await row(enPadron))!;
    const igual = { interviene: r.interviene, motivo: r.motivo, obraSocial: "", observaciones: "" };
    expect(await guardarFichaNnyaAction(convenioId, r.id, igual)).toEqual({ success: false, error: "No cambiaste ningún dato." });
    expect(
      await guardarFichaNnyaAction(convenioId, r.id, { ...igual, obraSocial: "IOMA (prueba)", observaciones: "Celíaco (prueba)" }),
    ).toEqual({
      success: true,
    });
    expect((await row(enPadron))?.obraSocial).toBe("IOMA (prueba)");
    const audit = JSON.parse((await ultimaAuditoria("CONVENIO_NNYA_DATOS")).details!);
    expect(audit).toEqual({ dni: enPadron, campos: "Obra social, Observaciones" });

    loginAs(deOtraArea);
    expect((await guardarFichaNnyaAction(convenioId, r.id, { ...igual, obraSocial: "Otra" })).success).toBe(false);
  });

  it("con horas toma el ingreso; si se borran, el que se sumó a mano queda en la lista sin ingreso", async () => {
    loginAs(operativo);
    expect(await guardarHorasAction(convenioId, null, { dni: enPadron, horas: "8", lugar: "HOSPITAL", fecha: ayer })).toEqual({
      success: true,
    });
    const conHoras = (await row(enPadron))!;
    expect(conHoras.ingreso?.toISOString().slice(0, 10)).toBe(ayer);
    // Con horas no se saca de la lista: se registra el egreso.
    const sacar = await sacarNnyaAction(convenioId, conHoras.id);
    expect(sacar.success).toBe(false);
    expect(!sacar.success && sacar.error).toContain("egreso");

    const hora = await prisma.convenioHora.findFirstOrThrow({ where: { agreementId: convenioId, dni: enPadron } });
    expect(await borrarHorasAction(convenioId, hora.id)).toEqual({ success: true });
    const sinHoras = await row(enPadron);
    expect(sinHoras).not.toBeNull();
    expect(sinHoras?.ingreso).toBeNull();
    expect(sinHoras?.obraSocial).toBe("IOMA (prueba)");
  });

  it("el que apareció solo por las horas se va de la lista al borrarlas, como antes", async () => {
    loginAs(operativo);
    expect(await guardarHorasAction(convenioId, null, { dni: enRegistro, horas: "4", lugar: "HOSPITAL", fecha: ayer })).toEqual({
      success: true,
    });
    expect((await row(enRegistro))?.createdById).toBeNull();
    const hora = await prisma.convenioHora.findFirstOrThrow({ where: { agreementId: convenioId, dni: enRegistro } });
    expect(await borrarHorasAction(convenioId, hora.id)).toEqual({ success: true });
    expect(await row(enRegistro)).toBeNull();
  });

  it("sin horas se saca de la lista y sigue en el Registro Único", async () => {
    loginAs(operativo);
    const r = (await row(nuevo))!;
    expect(await sacarNnyaAction(convenioId, r.id)).toEqual({ success: true });
    expect(await row(nuevo)).toBeNull();
    expect(await prisma.person.findUnique({ where: { dni: nuevo } })).not.toBeNull();
    expect(JSON.parse((await ultimaAuditoria("CONVENIO_NNYA_BAJA")).details!)).toEqual({ dni: nuevo });
  });
});
