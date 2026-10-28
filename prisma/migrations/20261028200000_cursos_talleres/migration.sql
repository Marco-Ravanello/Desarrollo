-- Cursos y talleres: inscriptos, clases y asistencia de cada clase (para el certificado).
CREATE TABLE IF NOT EXISTS "cursos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CURSO',
    "descripcion" TEXT,
    "areaId" TEXT,
    "programa" TEXT,
    "docente" TEXT,
    "lugar" TEXT,
    "horario" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "cargaHoraria" INTEGER,
    "asistenciaMinima" INTEGER NOT NULL DEFAULT 75,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "terminadoAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cursos_estado_idx" ON "cursos"("estado");
CREATE INDEX IF NOT EXISTS "cursos_areaId_idx" ON "cursos"("areaId");

DO $$ BEGIN
  ALTER TABLE "cursos" ADD CONSTRAINT "cursos_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "curso_inscriptos" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT,
    "telefono" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'INSCRIPTO',
    "bajaFecha" TIMESTAMP(3),
    "bajaMotivo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_inscriptos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "curso_inscriptos_cursoId_dni_key" ON "curso_inscriptos"("cursoId", "dni");
CREATE INDEX IF NOT EXISTS "curso_inscriptos_dni_idx" ON "curso_inscriptos"("dni");

DO $$ BEGIN
  ALTER TABLE "curso_inscriptos" ADD CONSTRAINT "curso_inscriptos_cursoId_fkey"
    FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "curso_clases" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tema" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_clases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "curso_clases_cursoId_fecha_key" ON "curso_clases"("cursoId", "fecha");

DO $$ BEGIN
  ALTER TABLE "curso_clases" ADD CONSTRAINT "curso_clases_cursoId_fkey"
    FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "curso_asistencias" (
    "claseId" TEXT NOT NULL,
    "inscriptoId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curso_asistencias_pkey" PRIMARY KEY ("claseId", "inscriptoId")
);

CREATE INDEX IF NOT EXISTS "curso_asistencias_inscriptoId_idx" ON "curso_asistencias"("inscriptoId");

DO $$ BEGIN
  ALTER TABLE "curso_asistencias" ADD CONSTRAINT "curso_asistencias_claseId_fkey"
    FOREIGN KEY ("claseId") REFERENCES "curso_clases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "curso_asistencias" ADD CONSTRAINT "curso_asistencias_inscriptoId_fkey"
    FOREIGN KEY ("inscriptoId") REFERENCES "curso_inscriptos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
