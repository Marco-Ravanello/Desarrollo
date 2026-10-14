// Aplica los cambios de base pendientes (prisma/migrations) antes de publicar.
//
// Corre solo en la publicación de producción de Vercel (VERCEL_ENV=production),
// no en las vistas previas de los PR ni en `npm run build` local. Para forzarlo
// en otro lado: MIGRATE_ON_BUILD=1 npm run build
//
// La base publicada se creó con `prisma db push` y los primeros cambios se
// aplicaron a mano, así que no tiene historial de migraciones. La primera vez,
// este script marca como aplicadas las migraciones que ya están en la base
// (según una tabla o columna que cada una crea) y después corre
// `prisma migrate deploy`, que aplica solo las que falten.
// Si algo falla, el build se frena y Vercel sigue sirviendo la versión anterior.

import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const shouldRun = process.env.VERCEL_ENV === "production" || process.env.MIGRATE_ON_BUILD === "1";
if (!shouldRun) {
  console.log("[migraciones] Se saltean: solo corren al publicar en producción.");
  process.exit(0);
}

// Migraciones que pueden estar en la base sin figurar en el historial, y cómo
// reconocerlas. Las que no estén acá las aplica `migrate deploy` normalmente.
const BASELINE = [
  { name: "20261001000000_init", check: `SELECT to_regclass('"User"') IS NOT NULL AS ok` },
  { name: "20261007000000_add_storm_emergency_tables", check: `SELECT to_regclass('"StormVictimRecord"') IS NOT NULL AS ok` },
  {
    name: "20261014000000_add_emergency_surveyor_role",
    check: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'StormVictimRecord' AND column_name = 'clientId') AS ok`,
  },
];

/** Las migraciones necesitan una conexión directa: el pooler de Neon no las soporta. */
function directDatabaseUrl() {
  const explicit = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  if (explicit) return explicit;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Falta DATABASE_URL");
  const url = new URL(raw);
  if (url.hostname.includes("-pooler.") && url.hostname.endsWith(".neon.tech")) {
    url.hostname = url.hostname.replace("-pooler.", ".");
    url.searchParams.delete("pgbouncer");
  }
  return url.toString();
}

const databaseUrl = directDatabaseUrl();
const env = { ...process.env, DATABASE_URL: databaseUrl };
const prismaCli = (...args) => execFileSync("npx", ["prisma", ...args], { stdio: "inherit", env });

async function baseline() {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const [{ hasHistory }] = await prisma.$queryRawUnsafe(`SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS "hasHistory"`);
    const recorded = hasHistory
      ? new Set((await prisma.$queryRawUnsafe(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)).map((r) => r.migration_name))
      : new Set();

    const toMark = [];
    for (const m of BASELINE) {
      if (recorded.has(m.name)) continue;
      const [{ ok }] = await prisma.$queryRawUnsafe(m.check);
      if (ok) toMark.push(m.name);
    }
    return toMark;
  } finally {
    await prisma.$disconnect();
  }
}

try {
  const toMark = await baseline();
  for (const name of toMark) {
    console.log(`[migraciones] ${name} ya está en la base: se marca como aplicada.`);
    prismaCli("migrate", "resolve", "--applied", name);
  }
  prismaCli("migrate", "deploy");
  console.log("[migraciones] Base al día.");
} catch (error) {
  console.error("[migraciones] No se pudieron aplicar los cambios de base. No se publica esta versión.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
