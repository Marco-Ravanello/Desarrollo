-- Tipo de intervención y correcciones con historial.
DO $$ BEGIN
  CREATE TYPE "InterventionType" AS ENUM ('VISITA', 'ENTREVISTA', 'LLAMADA', 'ENTREGA', 'GESTION', 'EMERGENCIA', 'OTRA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Intervention" ADD COLUMN IF NOT EXISTS "type" "InterventionType";
ALTER TABLE "Intervention" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "InterventionEdit" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "previousDescription" TEXT NOT NULL,
    "previousType" "InterventionType",
    "editedById" TEXT NOT NULL,
    "editedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionEdit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InterventionEdit_interventionId_idx" ON "InterventionEdit"("interventionId");

DO $$ BEGIN
  ALTER TABLE "InterventionEdit" ADD CONSTRAINT "InterventionEdit_interventionId_fkey"
    FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Las intervenciones que cargan solas las fichas de tormenta quedan como "Emergencia climática".
UPDATE "Intervention" SET "type" = 'EMERGENCIA'
WHERE "type" IS NULL
  AND ("description" LIKE 'Entrevista e inspección técnica de contingencia climática%'
       OR "description" LIKE 'Actualización de Ficha Tormenta%');
