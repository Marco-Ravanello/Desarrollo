import { afterAll, beforeAll, vi } from "vitest";
import prisma from "@/lib/prisma";

// La sesión la elige cada prueba con `loginAs` (ver helpers.ts).
vi.mock("@/auth", () => ({
  auth: async () => (globalThis as any).__testSession ?? null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

/** Vacía todas las tablas (menos el historial de migraciones) antes de cada archivo. */
beforeAll(async () => {
  const { hostname } = new URL(process.env.DATABASE_URL || "postgresql://sin-base");
  if (!["localhost", "127.0.0.1"].includes(hostname)) {
    throw new Error("Las pruebas de base solo corren contra una base local de prueba (TEST_DATABASE_URL).");
  }
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  );
  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
  (globalThis as any).__testSession = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});
