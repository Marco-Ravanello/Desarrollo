-- La contraseña la puso un administrador (alta o reseteo): la persona la cambia al ingresar.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
