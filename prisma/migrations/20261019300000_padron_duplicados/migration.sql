-- Posibles duplicados del padrón: pares revisados que resultaron ser personas distintas.
CREATE TABLE IF NOT EXISTS "padron_duplicados_descartados" (
    "dni_a" TEXT NOT NULL,
    "dni_b" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padron_duplicados_descartados_pkey" PRIMARY KEY ("dni_a","dni_b")
);
