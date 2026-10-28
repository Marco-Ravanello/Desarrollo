-- Límite de cada barrio dibujado en la app (reemplaza al contorno de OpenStreetMap que viene con la app).
CREATE TABLE IF NOT EXISTS "barrio_limites" (
    "barrio" TEXT NOT NULL,
    "puntos" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barrio_limites_pkey" PRIMARY KEY ("barrio")
);
