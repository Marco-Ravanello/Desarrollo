-- Control del gasto de los convenios por horas: valor hora con historial, cuidadoras y horas de cada día.
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "costMode" TEXT;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "monthlyCap" DECIMAL(14,2);
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "periodStartDay" INTEGER;
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "alertPercents" INTEGER[] DEFAULT ARRAY[70, 85, 95]::INTEGER[];

CREATE TABLE IF NOT EXISTS "convenio_valores_hora" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convenio_valores_hora_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "convenio_valores_hora_agreementId_desde_key" ON "convenio_valores_hora"("agreementId", "desde");

DO $$ BEGIN
  ALTER TABLE "convenio_valores_hora" ADD CONSTRAINT "convenio_valores_hora_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "convenio_cuidadoras" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dni" TEXT,
    "telefono" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convenio_cuidadoras_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "convenio_cuidadoras_agreementId_idx" ON "convenio_cuidadoras"("agreementId");

DO $$ BEGIN
  ALTER TABLE "convenio_cuidadoras" ADD CONSTRAINT "convenio_cuidadoras_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "convenio_horas" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cuidadoraId" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT,
    "horas" DECIMAL(5,2) NOT NULL,
    "lugar" TEXT NOT NULL,
    "lugarDetalle" TEXT,
    "observacion" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convenio_horas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "convenio_horas_agreementId_fecha_idx" ON "convenio_horas"("agreementId", "fecha");
CREATE INDEX IF NOT EXISTS "convenio_horas_cuidadoraId_idx" ON "convenio_horas"("cuidadoraId");
CREATE INDEX IF NOT EXISTS "convenio_horas_dni_idx" ON "convenio_horas"("dni");

DO $$ BEGIN
  ALTER TABLE "convenio_horas" ADD CONSTRAINT "convenio_horas_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "convenio_horas" ADD CONSTRAINT "convenio_horas_cuidadoraId_fkey"
    FOREIGN KEY ("cuidadoraId") REFERENCES "convenio_cuidadoras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
