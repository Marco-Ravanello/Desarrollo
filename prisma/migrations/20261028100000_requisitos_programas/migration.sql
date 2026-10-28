-- Requisitos simples de cada programa del padrón (edad, barrio, etiquetas, otros programas), para
-- mostrar en la página del programa quiénes los cumplen y todavía no están.
CREATE TABLE IF NOT EXISTS "programas_requisitos" (
    "programa" TEXT NOT NULL,
    "edadMin" INTEGER,
    "edadMax" INTEGER,
    "barrios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enProgramas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sinProgramas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nota" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programas_requisitos_pkey" PRIMARY KEY ("programa")
);
