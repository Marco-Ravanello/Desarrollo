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

### Rol de relevamiento de emergencia (octubre 2026)
El rol `RELEVADOR_EMERGENCIA` y las columnas nuevas de las fichas de tormenta están en `prisma/migrations/20261014000000_add_emergency_surveyor_role/migration.sql`. Ese archivo se puede correr más de una vez sin problemas. Para aplicarlo en la base publicada sin tocar el historial de migraciones:
```
npx prisma db execute --file prisma/migrations/20261014000000_add_emergency_surveyor_role/migration.sql
```
(con `DATABASE_URL` apuntando a esa base), o pegando el contenido del archivo en la consola SQL del proveedor de la base. Mientras no se aplique, la app sigue funcionando como antes, pero no deja asignar el rol nuevo.

## Modo sin conexión (Emergencia Climática)
`public/sw.js` guarda en el dispositivo la pantalla `/admin/emergency` y sus archivos (solo en producción). Las fichas cargadas sin internet quedan en el navegador (`src/lib/emergency-offline.ts`) y se envían a `/api/emergency/fichas` cuando vuelve la conexión; cada una lleva un `clientId`, así que reenviarla no la duplica. Al cerrar sesión se borra la pantalla guardada, pero no las fichas pendientes de envío.

## .env
```
DATABASE_URL="postgresql://user:password@localhost:5432/munidb?schema=public"
AUTH_SECRET="tu-secreto-aqui"
```

## Usuario administrador inicial (Seed)
`npx prisma db seed` crea `admin@municipio.gob.ar` solo si no existe. La clave inicial sale de `SEED_ADMIN_PASSWORD` o, si no está, se genera al azar y se muestra una vez en la consola. Si el usuario ya existe, el seed no cambia su clave.
