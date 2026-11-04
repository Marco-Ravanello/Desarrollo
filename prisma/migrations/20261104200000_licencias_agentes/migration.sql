-- Historial de licencias y vacaciones de cada agente (Recursos Humanos). Solo agrega una tabla nueva.
CREATE TABLE "HRLeave" (
    "id" TEXT NOT NULL,
    "hrRecordId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HRLeave_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "HRLeave_hrRecordId_startDate_idx" ON "HRLeave"("hrRecordId", "startDate");
-- CreateIndex
CREATE INDEX "HRLeave_startDate_endDate_idx" ON "HRLeave"("startDate", "endDate");
-- AddForeignKey
ALTER TABLE "HRLeave" ADD CONSTRAINT "HRLeave_hrRecordId_fkey" FOREIGN KEY ("hrRecordId") REFERENCES "HRRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
