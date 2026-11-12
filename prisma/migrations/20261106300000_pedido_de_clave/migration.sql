-- Pedido de clave temporal desde la pantalla de ingreso (idea 106): cuándo pidió la persona
-- una clave temporal. Se borra cuando el Superadmin la genera, cuando la persona descarta el
-- pedido o cuando entra bien con su contraseña. Solo agrega una columna que puede quedar vacía.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHelpRequestedAt" TIMESTAMP(3);
