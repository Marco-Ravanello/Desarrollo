-- Qué área tiene a cargo cada programa del padrón: esa área (y la conducción) da sus altas y bajas.
CREATE TABLE IF NOT EXISTS "programas_areas" (
    "programa" TEXT NOT NULL,
    "areaId" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programas_areas_pkey" PRIMARY KEY ("programa")
);

CREATE INDEX IF NOT EXISTS "programas_areas_areaId_idx" ON "programas_areas"("areaId");

DO $$ BEGIN
  ALTER TABLE "programas_areas" ADD CONSTRAINT "programas_areas_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
