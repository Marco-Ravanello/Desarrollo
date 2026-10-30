-- La cuidadora de cada fila de horas pasa a ser opcional: las contrata la asociación del convenio.
ALTER TABLE "convenio_horas" ALTER COLUMN "cuidadoraId" DROP NOT NULL;
