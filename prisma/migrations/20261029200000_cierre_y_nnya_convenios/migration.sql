-- Convenios por horas: períodos cerrados (quedan fijos) y cada NNyA con ingreso, egreso y expediente.
CREATE TABLE IF NOT EXISTS "convenio_periodos_cerrados" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "horas" DECIMAL(10,2) NOT NULL,
    "gastado" DECIMAL(14,2) NOT NULL,
    "tope" DECIMAL(14,2),
    "cerradoPorId" TEXT,
    "cerradoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convenio_periodos_cerrados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "convenio_periodos_cerrados_agreementId_desde_key" ON "convenio_periodos_cerrados"("agreementId", "desde");

DO $$ BEGIN
  ALTER TABLE "convenio_periodos_cerrados" ADD CONSTRAINT "convenio_periodos_cerrados_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "convenio_nnya" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT,
    "ingreso" TIMESTAMP(3) NOT NULL,
    "egreso" TIMESTAMP(3),
    "motivoEgreso" TEXT,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convenio_nnya_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "convenio_nnya_agreementId_dni_key" ON "convenio_nnya"("agreementId", "dni");
CREATE INDEX IF NOT EXISTS "convenio_nnya_caseId_idx" ON "convenio_nnya"("caseId");

DO $$ BEGIN
  ALTER TABLE "convenio_nnya" ADD CONSTRAINT "convenio_nnya_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "convenio_nnya" ADD CONSTRAINT "convenio_nnya_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Los NNyA que ya tienen horas cargadas: ingreso = su primer día con horas.
INSERT INTO "convenio_nnya" ("id", "agreementId", "dni", "nombre", "ingreso", "updatedAt")
SELECT 'nnya_' || md5(random()::text || clock_timestamp()::text || h."agreementId" || h."dni"),
       h."agreementId", h."dni", (array_agg(h."nombre" ORDER BY h."fecha" DESC) FILTER (WHERE h."nombre" IS NOT NULL))[1],
       MIN(h."fecha"), CURRENT_TIMESTAMP
FROM "convenio_horas" h
GROUP BY h."agreementId", h."dni"
ON CONFLICT ("agreementId", "dni") DO NOTHING;
