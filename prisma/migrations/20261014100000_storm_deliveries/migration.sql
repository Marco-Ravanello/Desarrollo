-- Entregas de elementos de las fichas de tormenta (descuentan stock).
-- Se puede correr más de una vez sin problemas (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS "StormDelivery" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "colchones" INTEGER NOT NULL DEFAULT 0,
    "camas" INTEGER NOT NULL DEFAULT 0,
    "cuchetas" INTEGER NOT NULL DEFAULT 0,
    "frazadas" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StormDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StormDelivery_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "StormVictimRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "StormDelivery_recordId_idx" ON "StormDelivery"("recordId");

-- Ya no hay refugios: se quita la tabla, que no tenía pantalla.
DROP TABLE IF EXISTS "Shelter";
