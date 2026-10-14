import prisma from "@/lib/prisma";

// La base publicada no corre las migraciones al desplegar. Hasta que se aplique
// prisma/migrations/20261014000000_add_emergency_surveyor_role, la carga de
// fichas sigue andando como antes (sin dueño ni control de duplicados) y el rol
// de relevador no se puede asignar.

let ready = false;

/** ¿La base ya tiene el rol de relevador y las columnas nuevas de las fichas? (solo lectura) */
export async function isEmergencyDbUpdated(): Promise<boolean> {
  if (ready) return true;
  try {
    const [role, columns] = await Promise.all([
      prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
         WHERE t.typname = 'Role' AND e.enumlabel = 'RELEVADOR_EMERGENCIA'`
      ),
      prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM information_schema.columns
         WHERE table_name = 'StormVictimRecord' AND column_name IN ('createdById', 'clientId')`
      ),
    ]);
    ready = role[0]?.n === 1 && columns[0]?.n === 2;
    return ready;
  } catch (err) {
    console.error("No se pudo revisar si la base tiene la actualización de emergencia:", err);
    return false;
  }
}

export const EMERGENCY_DB_PENDING_MESSAGE =
  "Falta actualizar la base de datos para usar el rol de relevamiento de emergencia. Pedile al equipo de sistemas que aplique la actualización.";

/** Columnas nuevas que hay que dejar afuera de las consultas mientras la base no esté actualizada. */
export async function stormRecordOmit() {
  return (await isEmergencyDbUpdated()) ? undefined : { createdById: true, clientId: true } as const;
}
