-- Altas y bajas de las personas en los programas del padrón (historia con fecha y quién la hizo).
CREATE TABLE IF NOT EXISTS "padron_movimientos" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "programa" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'APP',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padron_movimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "padron_movimientos_dni_idx" ON "padron_movimientos"("dni");
CREATE INDEX IF NOT EXISTS "padron_movimientos_programa_fecha_idx" ON "padron_movimientos"("programa", "fecha");
