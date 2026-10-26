-- Etiquetas de los expedientes (adulto mayor, discapacidad…), para filtrar y contar.
-- Los expedientes que ya existen quedan sin etiquetas.
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "Case_labels_idx" ON "Case" USING GIN ("labels");
