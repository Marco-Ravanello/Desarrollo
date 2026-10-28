import { describe, expect, it } from "vitest";
import {
  canDeleteCurso, canManageCurso, motivoSinCertificado, parseCursoInput, periodoTexto, resumenAsistencia, tieneCertificado,
} from "@/lib/cursos";

describe("formulario del curso", () => {
  const base = { nombre: "  Electricidad   domiciliaria ", fechaInicio: "2026-11-02" };

  it("limpia los textos y pone 75 % de asistencia si no se dice otra cosa", () => {
    const r = parseCursoInput({ ...base, tipo: "TALLER", programa: "prog_centro_de_formacion_profesional_3f", cargaHoraria: "40" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.nombre).toBe("Electricidad domiciliaria");
    expect(r.data.tipo).toBe("TALLER");
    expect(r.data.asistenciaMinima).toBe(75);
    expect(r.data.cargaHoraria).toBe(40);
    expect(r.data.programa).toBe("prog_centro_de_formacion_profesional_3f");
    expect(r.data.fechaInicio.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("ignora un programa que no existe y un tipo raro", () => {
    const r = parseCursoInput({ ...base, programa: "prog_inventado", tipo: "OTRO" });
    expect(r.ok && r.data.programa).toBeNull();
    expect(r.ok && r.data.tipo).toBe("CURSO");
  });

  it("rechaza lo que no tiene sentido", () => {
    expect(parseCursoInput({ fechaInicio: "2026-11-02" })).toEqual({ ok: false, error: "Escribí el nombre del curso." });
    expect(parseCursoInput({ nombre: "X" }).ok).toBe(false);
    expect(parseCursoInput({ ...base, fechaFin: "2026-10-01" })).toEqual({ ok: false, error: "El curso no puede terminar antes de empezar." });
    expect(parseCursoInput({ ...base, fechaInicio: "2026-02-30" }).ok).toBe(false);
    expect(parseCursoInput({ ...base, cargaHoraria: "2,5" }).ok).toBe(false);
    expect(parseCursoInput({ ...base, asistenciaMinima: "120" }).ok).toBe(false);
  });
});

describe("asistencia y certificado", () => {
  it("las faltas con aviso no cuentan", () => {
    expect(resumenAsistencia(["PRESENTE", "PRESENTE", "PRESENTE", "AUSENTE", "AVISO"])).toEqual({ presentes: 3, ausentes: 1, avisos: 1, porcentaje: 75 });
    expect(resumenAsistencia(["AVISO"]).porcentaje).toBeNull();
    expect(resumenAsistencia([]).porcentaje).toBeNull();
  });

  it("el certificado sale con el curso terminado y la asistencia mínima", () => {
    const terminado = { estado: "TERMINADO", asistenciaMinima: 75 };
    const inscripto = { estado: "INSCRIPTO" };
    const bien = resumenAsistencia(["PRESENTE", "PRESENTE", "PRESENTE", "AUSENTE"]);
    const poco = resumenAsistencia(["PRESENTE", "AUSENTE"]);
    expect(tieneCertificado(terminado, inscripto, bien)).toBe(true);
    expect(tieneCertificado({ ...terminado, estado: "ABIERTO" }, inscripto, bien)).toBe(false);
    expect(tieneCertificado(terminado, { estado: "DEJO" }, bien)).toBe(false);
    expect(motivoSinCertificado(terminado, inscripto, poco)).toBe("No llegó al 75 %");
    expect(motivoSinCertificado(terminado, inscripto, resumenAsistencia([]))).toBe("Sin asistencia anotada");
    expect(motivoSinCertificado({ ...terminado, estado: "ABIERTO" }, inscripto, bien)).toBe("El curso no terminó");
    // Sin mínimo: alcanza con seguir inscripto.
    expect(tieneCertificado({ estado: "TERMINADO", asistenciaMinima: 0 }, inscripto, resumenAsistencia([]))).toBe(true);
  });

  it("escribe el período", () => {
    expect(periodoTexto("2026-11-02", "2026-12-15")).toBe("Del 02/11/2026 al 15/12/2026");
    expect(periodoTexto("2026-11-02", null)).toBe("Desde el 02/11/2026");
  });
});

describe("quién maneja cada curso", () => {
  const curso = { areaId: "area-1", createdById: "u-creador" };
  it("la conducción, quien lo creó y su área", () => {
    expect(canManageCurso({ id: "x", role: "DIRECCION_GENERAL" }, curso)).toBe(true);
    expect(canManageCurso({ id: "u-creador", role: "OPERATIVO", areaId: "area-2" }, curso)).toBe(true);
    expect(canManageCurso({ id: "y", role: "OPERATIVO", areaId: "area-1" }, curso)).toBe(true);
    expect(canManageCurso({ id: "y", role: "OPERATIVO", areaId: "area-2" }, curso)).toBe(false);
    expect(canManageCurso({ id: "y", role: "AUDITOR", areaId: "area-1" }, curso)).toBe(false);
    expect(canManageCurso({ id: "y", role: "RELEVADOR_EMERGENCIA", areaId: "area-1" }, curso)).toBe(false);
    expect(canManageCurso({ id: "y", role: "OPERATIVO", areaId: "area-2" }, { areaId: null, createdById: null })).toBe(true);
  });
  it("lo borra la conducción o quien lo creó", () => {
    expect(canDeleteCurso({ id: "y", role: "OPERATIVO", areaId: "area-1" }, curso)).toBe(false);
    expect(canDeleteCurso({ id: "u-creador", role: "OPERATIVO" }, curso)).toBe(true);
    expect(canDeleteCurso({ id: "z", role: "ADMIN_GENERAL" }, curso)).toBe(true);
  });
});
