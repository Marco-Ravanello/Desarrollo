-- Conversaciones guardadas del Asistente de IA. Solo agrega dos tablas nuevas.
CREATE TABLE "asistente_conversaciones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asistente_conversaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asistente_mensajes" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistente_mensajes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asistente_conversaciones_userId_updatedAt_idx" ON "asistente_conversaciones"("userId", "updatedAt");
CREATE INDEX "asistente_conversaciones_updatedAt_idx" ON "asistente_conversaciones"("updatedAt");
CREATE INDEX "asistente_mensajes_conversationId_createdAt_idx" ON "asistente_mensajes"("conversationId", "createdAt");

ALTER TABLE "asistente_conversaciones" ADD CONSTRAINT "asistente_conversaciones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asistente_mensajes" ADD CONSTRAINT "asistente_mensajes_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "asistente_conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
