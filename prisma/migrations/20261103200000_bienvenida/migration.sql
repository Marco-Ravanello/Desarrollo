-- Bienvenida de la primera vez: cuándo la cerró cada persona (null = todavía no la vio).
ALTER TABLE "User" ADD COLUMN "welcomeSeenAt" TIMESTAMP(3);
