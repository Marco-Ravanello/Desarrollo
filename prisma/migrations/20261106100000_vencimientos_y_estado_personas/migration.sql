-- Documentos con vencimiento (por ejemplo, el CUD) y personas que fallecieron o se mudaron fuera del distrito.
-- Solo agrega columnas opcionales a "Document" (y deja cargar un vencimiento sin archivo) y una tabla nueva.
ALTER TABLE "Document" ADD COLUMN "kind" TEXT;
ALTER TABLE "Document" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "uploadedById" TEXT;
ALTER TABLE "Document" ALTER COLUMN "url" DROP NOT NULL;
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

CREATE TABLE "personas_estado" (
    "dni" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "fecha" TIMESTAMP(3),
    "nota" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personas_estado_pkey" PRIMARY KEY ("dni")
);
