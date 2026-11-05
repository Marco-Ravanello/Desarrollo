-- Preguntas que el Asistente de IA no pudo responder, para que el Superadmin vea cuáles faltan.
-- Solo agrega una tabla nueva. Se guarda la pregunta (con los números largos tapados), nunca la respuesta.
CREATE TABLE "asistente_preguntas_sin_respuesta" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "role" TEXT,
    "areaName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "asistente_preguntas_sin_respuesta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asistente_preguntas_sin_respuesta_key_idx" ON "asistente_preguntas_sin_respuesta"("key");
CREATE INDEX "asistente_preguntas_sin_respuesta_createdAt_idx" ON "asistente_preguntas_sin_respuesta"("createdAt");
