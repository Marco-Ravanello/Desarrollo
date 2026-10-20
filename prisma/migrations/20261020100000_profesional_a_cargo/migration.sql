-- Profesional a cargo de cada expediente.
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Case_assignedToId_idx" ON "Case"("assignedToId");

DO $$ BEGIN
  ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
