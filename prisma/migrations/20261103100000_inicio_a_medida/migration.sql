-- Orden y tarjetas escondidas del Inicio que eligió cada persona.
ALTER TABLE "User" ADD COLUMN "homeLayout" JSONB;
