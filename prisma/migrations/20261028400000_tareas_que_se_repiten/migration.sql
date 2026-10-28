-- Tareas que se repiten: cada cuánto, y la tarea que se creó sola al marcarla como hecha
-- (para no crear otra si se vuelve a abrir y a cerrar).
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeat" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "nextTaskId" TEXT;
