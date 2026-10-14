-- Nuevo rol: carga exclusiva de fichas de emergencia climática.
-- Se puede correr más de una vez sin problemas (IF NOT EXISTS).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'RELEVADOR_EMERGENCIA';

-- Quién cargó cada ficha y el identificador del dispositivo (fichas cargadas sin conexión).
ALTER TABLE "StormVictimRecord" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "StormVictimRecord" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StormVictimRecord_clientId_key" ON "StormVictimRecord"("clientId");
CREATE INDEX IF NOT EXISTS "StormVictimRecord_createdById_idx" ON "StormVictimRecord"("createdById");
