-- Filtros de la lista de Expedientes que guardó cada persona (nombre y búsqueda).
ALTER TABLE "User" ADD COLUMN "caseFilters" JSONB;
