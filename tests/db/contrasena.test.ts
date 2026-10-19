import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { changeOwnPasswordAction } from "@/app/(dashboard)/cambiar-clave/actions";
import { createUserAction, updateUserAction } from "@/app/(dashboard)/admin/actions/user-actions";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
const form = (data: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
};

describe("cambiar la propia contraseña", () => {
  let admin: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    admin = await createUser("ADMIN_GENERAL");
  });

  it("un usuario nuevo tiene que cambiar la contraseña que le puso el administrador", async () => {
    loginAs(admin);
    const res = await createUserAction(form({ name: "Nueva", email: "nueva@prueba.test", password: "temporal1", role: "OPERATIVO" }));
    expect(res.success).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "nueva@prueba.test" } });
    expect(user.mustChangePassword).toBe(true);
  });

  it("pide la contraseña actual y una nueva válida, y después deja de pedir el cambio", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "nueva@prueba.test" } });
    loginAs(user);

    expect(await changeOwnPasswordAction({ current: "otra-cosa", next: "Arbolito2026", confirm: "Arbolito2026" })).toMatchObject({ success: false, field: "current" });
    expect(await prisma.auditLog.count({ where: { userId: user.id, action: "LOGIN_FAILED" } })).toBe(1);
    expect(await changeOwnPasswordAction({ current: "temporal1", next: "corta1", confirm: "corta1" })).toMatchObject({ success: false, field: "next" });
    expect(await changeOwnPasswordAction({ current: "temporal1", next: "Arbolito2026", confirm: "Arbolito2027" })).toMatchObject({ success: false, field: "confirm" });

    expect(await changeOwnPasswordAction({ current: "temporal1", next: "Arbolito2026", confirm: "Arbolito2026" })).toEqual({ success: true });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("Arbolito2026", after.password!)).toBe(true);
    expect(await prisma.auditLog.count({ where: { userId: user.id, action: "PASSWORD_CHANGED" } })).toBe(1);
  });

  it("si el administrador le pone otra contraseña, vuelve a pedir el cambio; si se la cambia a sí mismo, no", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "nueva@prueba.test" } });
    loginAs(admin);
    await updateUserAction({ id: user.id, name: "Nueva", email: user.email!, role: "OPERATIVO", password: "reseteada1" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(true);

    await updateUserAction({ id: admin.id, name: "Admin", email: admin.email!, role: "ADMIN_GENERAL", password: "propia123" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).mustChangePassword).toBe(false);
  });

  it("después de 5 intentos con la contraseña actual equivocada, se bloquea un rato", async () => {
    const user = await createUser("OPERATIVO");
    await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash("Correcta2026", 10) } });
    loginAs(user);
    for (let i = 0; i < 5; i++) {
      await changeOwnPasswordAction({ current: `mala${i}`, next: "Nueva2026x", confirm: "Nueva2026x" });
    }
    const res = await changeOwnPasswordAction({ current: "Correcta2026", next: "Nueva2026x", confirm: "Nueva2026x" });
    expect(res).toMatchObject({ success: false, field: "current" });
    expect(res.success === false && res.error).toMatch(/15 minutos/);
  });

  it("sin sesión no cambia nada", async () => {
    loginAs(null);
    expect((await changeOwnPasswordAction({ current: "x", next: "Arbolito2026", confirm: "Arbolito2026" })).success).toBe(false);
  });
});
