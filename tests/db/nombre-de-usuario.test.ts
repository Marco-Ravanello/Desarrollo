import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createUserAction, updateUserAction } from "@/app/(dashboard)/admin/actions/user-actions";
import { findUserForLogin } from "@/services/login-security";
import { createUser, loginAs } from "./helpers";

// Usuarios inventados, solo en la base de prueba local.
const form = (data: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
};

describe("ingreso con nombre de usuario", () => {
  it("al publicar, cada usuario que ya existía recibe el nombre que está antes de la @", async () => {
    await prisma.user.createMany({
      data: [
        { id: "u1", email: "Juan.Perez@muni.test", createdAt: new Date("2026-01-01") },
        { id: "u2", email: "juan.perez@otra.test", createdAt: new Date("2026-02-01") },
        { id: "u3", email: "ana+prueba@muni.test" },
        { id: "u4", email: null },
        { id: "u5", email: "juan.perez-2@muni.test" },
      ],
    });
    execFileSync(
      "npx",
      ["prisma", "db", "execute", "--url", process.env.DATABASE_URL!, "--file", "prisma/migrations/20261021200000_nombre_de_usuario/migration.sql"],
      { stdio: "pipe" }
    );
    const rows = await prisma.user.findMany({ where: { id: { in: ["u1", "u2", "u3", "u4", "u5"] } }, orderBy: { id: "asc" } });
    const names = Object.fromEntries(rows.map((u) => [u.id, u.username]));
    expect(names.u1).toBe("juan.perez");
    expect(names.u3).toBe("anaprueba");
    expect(names.u4).toBe("usuario");
    // u2 (el segundo "juan.perez") y u5 chocan en "juan.perez-2": el más nuevo suma un pedacito del id.
    expect(names.u2).toBe("juan.perez-2");
    expect(names.u5).toBe("juan.perez-2-u5");
    expect(new Set(Object.values(names)).size).toBe(5);
  });

  it("se encuentra la cuenta por usuario (sin importar mayúsculas) o por correo", async () => {
    const u = await prisma.user.create({ data: { username: "maria.gomez", email: "maria@muni.test" } });
    expect((await findUserForLogin("Maria.Gomez "))?.id).toBe(u.id);
    expect((await findUserForLogin("MARIA@muni.test"))?.id).toBe(u.id);
    expect(await findUserForLogin("maria")).toBeNull();
    expect(await findUserForLogin("")).toBeNull();
  });

  it("el Superadmin crea usuarios con nombre de usuario y correo opcional", async () => {
    loginAs(await createUser("SUPERADMIN"));
    const ok = await createUserAction(form({ name: "Lía Sosa", username: " Lia.Sosa ", email: "", password: "temporal12", role: "OPERATIVO" }));
    expect(ok.success).toBe(true);
    const lia = await prisma.user.findUniqueOrThrow({ where: { username: "lia.sosa" } });
    expect(lia.email).toBeNull();

    expect(await createUserAction(form({ name: "Otra", username: "lia.sosa", password: "temporal12", role: "OPERATIVO" }))).toMatchObject({
      success: false,
      error: "Ya hay otra persona con ese nombre de usuario.",
    });
    expect((await createUserAction(form({ name: "Sin", username: "", password: "temporal12", role: "OPERATIVO" }))).success).toBe(false);
    expect((await createUserAction(form({ name: "Mal", username: "con espacio", password: "temporal12", role: "OPERATIVO" }))).success).toBe(false);
    expect((await createUserAction(form({ name: "Mal", username: "bueno", email: "no-es-correo", password: "temporal12", role: "OPERATIVO" }))).success).toBe(false);
  });

  it("solo el Superadmin cambia el nombre de usuario; el correo se puede borrar", async () => {
    const target = await prisma.user.create({ data: { username: "pedro", email: "pedro@muni.test", name: "Pedro", role: "OPERATIVO" } });
    loginAs(await createUser("ADMIN_GENERAL"));
    expect(await updateUserAction({ id: target.id, name: "Pedro", username: "pedro.r", email: "pedro@muni.test", role: "OPERATIVO" })).toMatchObject({
      success: false,
      error: "Solo el Superadmin puede cambiar el nombre de usuario.",
    });
    expect((await updateUserAction({ id: target.id, name: "Pedro R", email: "", role: "OPERATIVO" })).success).toBe(true);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ username: "pedro", email: null, name: "Pedro R" });

    loginAs(await createUser("SUPERADMIN"));
    expect((await updateUserAction({ id: target.id, name: "Pedro R", username: "Pedro.R", role: "OPERATIVO" })).success).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).username).toBe("pedro.r");
  });
});
