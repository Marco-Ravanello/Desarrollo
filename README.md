# Plataforma Municipal de Desarrollo Humano y Hábitat

MVP de plataforma web interna para centralizar información social y administrativa.

## Instalación Local
1. `npm install`
2. `docker-compose up -d`
3. Configurar `.env`
4. `npx prisma migrate deploy` (crea todas las tablas desde cero)
5. `npm run dev`

Antes de publicar, `npx tsc --noEmit` y `npm run lint` deben pasar sin errores: el build se frena si hay errores de tipos o de ESLint.

## Migraciones en una base que ya existe
La base publicada se creó con `prisma db push`, sin historial de migraciones. Antes de usar `prisma migrate deploy` contra ella hay que marcar como aplicadas las migraciones que ya están reflejadas en la base (una sola vez):
```
npx prisma migrate resolve --applied 20261001000000_init
npx prisma migrate resolve --applied 20261007000000_add_storm_emergency_tables
```
De ahí en adelante, cada cambio de `schema.prisma` se acompaña con su migración (`npx prisma migrate dev --name descripcion`).

## .env
```
DATABASE_URL="postgresql://user:password@localhost:5432/munidb?schema=public"
AUTH_SECRET="tu-secreto-aqui"
```

## Credenciales de prueba (Seed)
- **Email**: admin@municipio.gob.ar
- **Password**: admin123
