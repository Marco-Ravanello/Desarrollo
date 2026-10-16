-- Otros insumos (chapas, nylon...) pedidos en las fichas de tormenta y entregados.
-- Se puede correr más de una vez sin problemas (IF NOT EXISTS).
ALTER TABLE "StormVictimRecord" ADD COLUMN IF NOT EXISTS "otrosElementos" JSONB;
ALTER TABLE "StormDelivery" ADD COLUMN IF NOT EXISTS "otrosElementos" JSONB;
