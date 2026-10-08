-- CreateTable
CREATE TABLE IF NOT EXISTS "StormEmergencySheet" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorId" TEXT,
    "operatorName" TEXT NOT NULL,
    "areaId" TEXT,
    "areaName" TEXT NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StormEmergencySheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StormVictimRecord" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT,
    "itemNumber" INTEGER NOT NULL DEFAULT 1,
    "personId" TEXT,
    "nombreApellido" TEXT NOT NULL,
    "dni" TEXT,
    "edad" TEXT,
    "grupoFamiliar" BOOLEAN NOT NULL DEFAULT false,
    "ninos" TEXT,
    "domicilio" TEXT NOT NULL,
    "referencia" TEXT,
    "barrio" TEXT,
    "requiereColchon" BOOLEAN NOT NULL DEFAULT false,
    "cantidadColchon" INTEGER NOT NULL DEFAULT 0,
    "requiereCama" BOOLEAN NOT NULL DEFAULT false,
    "cantidadCama" INTEGER NOT NULL DEFAULT 0,
    "requiereCucheta" BOOLEAN NOT NULL DEFAULT false,
    "cantidadCucheta" INTEGER NOT NULL DEFAULT 0,
    "requiereFrazada" BOOLEAN NOT NULL DEFAULT false,
    "cantidadFrazada" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "contacto" TEXT,
    "agentes" TEXT,
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "descripcionIntervencion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'REGISTRADO',
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StormVictimRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StormVictimRecord_dni_idx" ON "StormVictimRecord"("dni");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StormVictimRecord_sheetId_idx" ON "StormVictimRecord"("sheetId");

-- AddForeignKey
ALTER TABLE "StormVictimRecord" ADD CONSTRAINT "StormVictimRecord_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "StormEmergencySheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StormVictimRecord" ADD CONSTRAINT "StormVictimRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StormVictimRecord" ADD CONSTRAINT "StormVictimRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
