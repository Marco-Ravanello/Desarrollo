-- Derivaciones con respuesta: quién derivó, quién respondió, cuándo y por qué.
ALTER TABLE "Derivation" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Derivation" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
ALTER TABLE "Derivation" ADD COLUMN IF NOT EXISTS "previousStatus" "CaseStatus";
ALTER TABLE "Derivation" ADD COLUMN IF NOT EXISTS "respondedById" TEXT;
ALTER TABLE "Derivation" ADD COLUMN IF NOT EXISTS "respondedByName" TEXT;
ALTER TABLE "Derivation" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
ALTER TABLE "Derivation" ADD COLUMN IF NOT EXISTS "response" TEXT;

CREATE INDEX IF NOT EXISTS "Derivation_toAreaId_status_idx" ON "Derivation"("toAreaId", "status");
CREATE INDEX IF NOT EXISTS "Derivation_caseId_idx" ON "Derivation"("caseId");
