import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { closeCaseAction, reopenCaseAction } from "@/app/(dashboard)/people/actions/close-case";
import { assignCaseAction, createDerivationAction, respondDerivationAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { createUserAction, resetTemporaryPasswordAction, toggleUserStatusAction, updateUserAction } from "@/app/(dashboard)/admin/actions/user-actions";
import { getCaseEvents } from "@/services/case-timeline";
import { isAccountLocked } from "@/services/login-security";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("cerrar y reabrir un expediente con motivo", () => {
  let social: Awaited<ReturnType<typeof createArea>>;
  let ninez: Awaited<ReturnType<typeof createArea>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let caseId: string;

  beforeAll(async () => {
    social = await createArea("Protección Social (prueba cierre)");
    ninez = await createArea("Niñez (prueba cierre)");
    operativo = await createUser("OPERATIVO", social.id);
    const person = await prisma.person.create({ data: { dni: "95000001", firstName: "Titular", lastName: "Cierre" } });
    caseId = (await prisma.case.create({ data: { title: "Caso a cerrar", personId: person.id, areaId: social.id } })).id;
  });

  const status = async () => (await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).status;

  it("sin motivo no se cierra, y Auditoría no puede cerrar", async () => {
    loginAs(operativo);
    expect((await closeCaseAction(caseId, "  ")).success).toBe(false);
    loginAs(await createUser("AUDITOR", social.id));
    expect((await closeCaseAction(caseId, "Se resolvió")).success).toBe(false);
    expect(await status()).toBe("ABIERTO");
  });

  it("con una derivación sin responder no se cierra", async () => {
    loginAs(operativo);
    expect((await createDerivationAction(caseId, ninez.id, "Corresponde a Niñez")).success).toBe(true);
    const res = await closeCaseAction(caseId, "Se resolvió");
    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/derivación sin responder/) });
    const d = await prisma.derivation.findFirstOrThrow({ where: { caseId } });
    loginAs(await createUser("DIRECTOR_AREA", ninez.id));
    expect((await respondDerivationAction(d.id, false, "No es de Niñez")).success).toBe(true);
  });

  it("se cierra con motivo; cerrado no se puede volver a cerrar ni asignar", async () => {
    loginAs(operativo);
    expect(await closeCaseAction(caseId, "Se consiguió la vivienda")).toEqual({ success: true });
    expect(await status()).toBe("CERRADO");
    expect((await closeCaseAction(caseId, "Otra vez")).success).toBe(false);
    expect((await assignCaseAction(caseId, operativo.id)).success).toBe(false);
  });

  it("se reabre con motivo y queda abierto", async () => {
    loginAs(operativo);
    expect((await reopenCaseAction(caseId, "")).success).toBe(false);
    expect(await reopenCaseAction(caseId, "La familia volvió a consultar")).toEqual({ success: true });
    expect(await status()).toBe("ABIERTO");
    expect((await reopenCaseAction(caseId, "Otra vez")).success).toBe(false);
  });

  it("el cierre y la reapertura quedan en la historia con su motivo", async () => {
    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    const events = await getCaseEvents({ id: caseId, createdAt: c.createdAt, areaName: social.name }, []);
    const movimientos = events.filter((e) => e.kind === "CIERRE" || e.kind === "REAPERTURA");
    expect(movimientos).toEqual([
      expect.objectContaining({ kind: "CIERRE", title: "Se cerró el expediente", detail: "Motivo: Se consiguió la vivienda", author: operativo.name }),
      expect.objectContaining({ kind: "REAPERTURA", title: "Se reabrió el expediente", detail: "Motivo: La familia volvió a consultar", author: operativo.name }),
    ]);
  });

  it("un expediente de Violencia de Género solo lo cierra quien puede verlo", async () => {
    const vg = await createArea("Violencia de Género (prueba cierre)");
    const person = await prisma.person.create({ data: { dni: "95000002", firstName: "Titular", lastName: "Reservada" } });
    const vgCase = await prisma.case.create({ data: { title: "Reservado", personId: person.id, areaId: vg.id } });
    loginAs(operativo);
    expect((await closeCaseAction(vgCase.id, "Se resolvió")).success).toBe(false);
    loginAs(await createUser("VIOLENCIA_GENERO", vg.id));
    expect((await closeCaseAction(vgCase.id, "Se resolvió")).success).toBe(true);
  });
});

const form = (data: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
};

describe("usuarios y contraseñas: solo el Superadmin", () => {
  let superadmin: Awaited<ReturnType<typeof createUser>>;
  let adminGeneral: Awaited<ReturnType<typeof createUser>>;
  let direccion: Awaited<ReturnType<typeof createUser>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    superadmin = await createUser("SUPERADMIN");
    adminGeneral = await createUser("ADMIN_GENERAL");
    direccion = await createUser("DIRECCION_GENERAL");
    operativo = await createUser("OPERATIVO");
    await prisma.user.update({ where: { id: operativo.id }, data: { password: await bcrypt.hash("Original2026", 10) } });
  });

  it("Admin General y Dirección General ya no crean usuarios; el Superadmin sí", async () => {
    for (const u of [adminGeneral, direccion]) {
      loginAs(u);
      expect((await createUserAction(form({ name: "X", email: `nuevo-${u.role}@prueba.test`, password: "temporal12", role: "OPERATIVO" }))).success).toBe(false);
    }
    loginAs(superadmin);
    expect((await createUserAction(form({ name: "X", email: "nuevo-sa@prueba.test", password: "corta", role: "OPERATIVO" }))).success).toBe(false);
    expect((await createUserAction(form({ name: "X", email: "nuevo-sa@prueba.test", password: "temporal12", role: "OPERATIVO" }))).success).toBe(true);
    expect(await prisma.user.count({ where: { email: { startsWith: "nuevo-" } } })).toBe(1);
  });

  it("Admin General sigue editando rol, área y estado, pero no la contraseña de otra persona", async () => {
    loginAs(adminGeneral);
    const base = { id: operativo.id, name: "Operativo", email: operativo.email!, role: "DIRECTOR_AREA" as const };
    expect((await updateUserAction({ ...base, password: "Robada2026" })).success).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: operativo.id } });
    expect(await bcrypt.compare("Original2026", after.password!)).toBe(true);
    expect(after.role).toBe("OPERATIVO");

    expect((await updateUserAction(base)).success).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: operativo.id } })).role).toBe("DIRECTOR_AREA");
    expect((await toggleUserStatusAction(operativo.id)).success).toBe(true);
    expect((await toggleUserStatusAction(operativo.id)).success).toBe(true);
  });

  it("la clave temporal solo la genera el Superadmin, y no para su propia cuenta", async () => {
    for (const u of [adminGeneral, direccion, operativo]) {
      loginAs(u);
      expect((await resetTemporaryPasswordAction(operativo.id)).success).toBe(false);
    }
    loginAs(superadmin);
    expect((await resetTemporaryPasswordAction(superadmin.id)).success).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: operativo.id } });
    expect(await bcrypt.compare("Original2026", after.password!)).toBe(true);
  });

  it("genera una clave nueva, la vieja deja de andar, pide cambiarla al ingresar y destraba la cuenta", async () => {
    await prisma.auditLog.createMany({
      data: Array.from({ length: 5 }, () => ({ userId: operativo.id, action: "LOGIN_FAILED", entity: "User", entityId: operativo.id })),
    });
    expect(await isAccountLocked(operativo.id)).toBe(true);

    loginAs(superadmin);
    const res = await resetTemporaryPasswordAction(operativo.id);
    expect(res.success).toBe(true);
    const password = res.success ? res.password : "";
    expect(password).toMatch(/^[a-z]{4}-\d{4}-[a-z]{4}$/);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: operativo.id } });
    expect(await bcrypt.compare(password, after.password!)).toBe(true);
    expect(await bcrypt.compare("Original2026", after.password!)).toBe(false);
    expect(after.mustChangePassword).toBe(true);
    expect(await isAccountLocked(operativo.id)).toBe(false);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "PASSWORD_RESET", entityId: operativo.id } });
    expect(log.userId).toBe(superadmin.id);
    expect(log.details).not.toContain(password);
  });
});
