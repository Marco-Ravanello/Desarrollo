-- Idea 124: una intervención puede hacerla más de un profesional ("fuimos con Lucía").
-- Quien la cargó sigue en "userId"; los que fueron con esa persona, acá.
ALTER TABLE "Intervention" ADD COLUMN IF NOT EXISTS "withUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX IF NOT EXISTS "Intervention_withUserIds_idx" ON "Intervention" USING GIN ("withUserIds");
