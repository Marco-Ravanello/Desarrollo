import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Pruebas rápidas sin base de datos (permisos, cálculos). Corren también en
// cada build, así que si alguna falla no se publica la versión nueva.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
