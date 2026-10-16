import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Pruebas contra una base de datos de prueba vacía (TEST_DATABASE_URL), nunca
// contra la base real: fichas, entregas, stock y permisos de las acciones.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    setupFiles: ["tests/db/setup.ts"],
    // Comparten la base: una a la vez.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
  },
});
