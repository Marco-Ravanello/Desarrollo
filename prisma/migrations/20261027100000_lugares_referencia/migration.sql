-- Lugares de referencia de cada barrio (escuela, salita, comedor…) con su contacto.
CREATE TABLE IF NOT EXISTS "lugares_referencia" (
    "id" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "contacto" TEXT,
    "horario" TEXT,
    "notas" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lugares_referencia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lugares_referencia_barrio_idx" ON "lugares_referencia"("barrio");
