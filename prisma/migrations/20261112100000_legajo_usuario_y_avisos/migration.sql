-- Idea 127: el legajo de Recursos Humanos se puede unir con la cuenta de la app de esa persona.
ALTER TABLE "HRRecord" ADD COLUMN IF NOT EXISTS "userId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "HRRecord_userId_key" ON "HRRecord"("userId");
ALTER TABLE "HRRecord" ADD CONSTRAINT "HRRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Idea 130: la campanita revisa seguimientos y vencimientos cada 30 minutos como mucho (no en cada consulta),
-- y busca los avisos de cada persona por índice.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "noticesCheckedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
