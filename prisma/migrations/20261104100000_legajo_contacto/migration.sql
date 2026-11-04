-- Datos de contacto en el legajo de Recursos Humanos (todos opcionales).
ALTER TABLE "HRRecord" ADD COLUMN "phone" TEXT;
ALTER TABLE "HRRecord" ADD COLUMN "email" TEXT;
ALTER TABLE "HRRecord" ADD COLUMN "address" TEXT;
ALTER TABLE "HRRecord" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "HRRecord" ADD COLUMN "emergencyContactName" TEXT;
ALTER TABLE "HRRecord" ADD COLUMN "emergencyContactPhone" TEXT;
