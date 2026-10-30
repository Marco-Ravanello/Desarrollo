-- Ficha de cada niño, niña o adolescente de un convenio por horas: se puede sumar antes de tener horas
-- y guarda los datos del acompañamiento.
ALTER TABLE "convenio_nnya" ALTER COLUMN "ingreso" DROP NOT NULL;
ALTER TABLE "convenio_nnya" ADD COLUMN "interviene" TEXT;
ALTER TABLE "convenio_nnya" ADD COLUMN "motivo" TEXT;
ALTER TABLE "convenio_nnya" ADD COLUMN "obraSocial" TEXT;
ALTER TABLE "convenio_nnya" ADD COLUMN "observaciones" TEXT;
ALTER TABLE "convenio_nnya" ADD COLUMN "createdById" TEXT;
