-- Seguimientos agendados desde un expediente: la tarea queda unida al expediente
-- y se anota cuándo se avisó, para avisar una sola vez.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "caseId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Task_caseId_idx" ON "Task"("caseId");

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
