-- Índices para que la ficha, el expediente, Carga del equipo, la descarga de intervenciones y Mis tareas
-- sigan rápidos con años de datos (idea 131). Solo agrega índices: no cambia datos.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_personId_idx" ON "Document"("personId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_caseId_idx" ON "Document"("caseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Intervention_caseId_date_idx" ON "Intervention"("caseId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Intervention_personId_date_idx" ON "Intervention"("personId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Intervention_userId_date_idx" ON "Intervention"("userId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Intervention_date_idx" ON "Intervention"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");

