-- Estado de la búsqueda de ubicación de cada dirección del padrón (Ubicar en el mapa).
-- Se puede correr más de una vez.
ALTER TABLE "padron_unificado" ADD COLUMN IF NOT EXISTS "geo_estado" TEXT;
ALTER TABLE "padron_unificado" ADD COLUMN IF NOT EXISTS "geo_fuente" TEXT;
ALTER TABLE "padron_unificado" ADD COLUMN IF NOT EXISTS "geo_actualizado" TIMESTAMP(3);
