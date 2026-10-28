-- Barrios: punto en el mapa de los lugares de referencia, recorridas con su lista de visitas
-- y la persona del equipo a la que le toca cada barrio.
ALTER TABLE "lugares_referencia" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "lugares_referencia" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "recorridas" (
    "id" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "objetivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PLANIFICADA',
    "equipoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hallazgos" TEXT,
    "pendientes" TEXT,
    "terminadaAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recorridas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recorridas_barrio_fecha_idx" ON "recorridas"("barrio", "fecha");

CREATE TABLE IF NOT EXISTS "recorrida_visitas" (
    "id" TEXT NOT NULL,
    "recorridaId" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT,
    "direccion" TEXT,
    "motivo" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "resultado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "nota" TEXT,
    "visitadaAt" TIMESTAMP(3),
    "visitadaPorId" TEXT,

    CONSTRAINT "recorrida_visitas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recorrida_visitas_recorridaId_dni_key" ON "recorrida_visitas"("recorridaId", "dni");
CREATE INDEX IF NOT EXISTS "recorrida_visitas_dni_idx" ON "recorrida_visitas"("dni");

DO $$ BEGIN
  ALTER TABLE "recorrida_visitas" ADD CONSTRAINT "recorrida_visitas_recorridaId_fkey"
    FOREIGN KEY ("recorridaId") REFERENCES "recorridas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "barrio_referentes" (
    "barrio" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barrio_referentes_pkey" PRIMARY KEY ("barrio")
);

CREATE INDEX IF NOT EXISTS "barrio_referentes_userId_idx" ON "barrio_referentes"("userId");
