-- Programa "Emergencia climática" del padrón: lo marcan las fichas de tormenta.
ALTER TABLE "padron_unificado" ADD COLUMN IF NOT EXISTS "prog_emergencia_climatica" INTEGER NOT NULL DEFAULT 0;
