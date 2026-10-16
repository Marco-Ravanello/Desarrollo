import { execFileSync } from "node:child_process";

/**
 * Prepara la base de prueba: aplica todas las migraciones desde cero, como en
 * una base nueva. Se niega a correr contra algo que no sea una base local,
 * porque las pruebas cargan datos de prueba y vacían las tablas.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Falta TEST_DATABASE_URL: las pruebas de base corren solo contra una base de prueba local y vacía.");
  }
  const { hostname } = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(hostname)) {
    throw new Error(`TEST_DATABASE_URL apunta a ${hostname}. Por seguridad, solo se aceptan bases locales (localhost).`);
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
