# Plataforma Municipal de Desarrollo Humano y Hábitat

MVP de plataforma web interna para centralizar información social y administrativa.

## Instalación Local
1. `npm install`
2. `docker-compose up -d`
3. Configurar `.env`
4. `npx prisma migrate deploy` (crea todas las tablas desde cero)
5. `npm run dev`

Antes de publicar, `npx tsc --noEmit` y `npm run lint` deben pasar sin errores: el build se frena si hay errores de tipos o de ESLint.

## Cambios de base al publicar (automático)
`npm run build` corre `scripts/migrate-on-deploy.mjs`, que en la publicación de producción de Vercel (`VERCEL_ENV=production`) aplica las migraciones pendientes de `prisma/migrations` antes de compilar. No corre en las vistas previas de los PR ni en un build local (para forzarlo: `MIGRATE_ON_BUILD=1`). Si la base no tiene historial de migraciones, primero marca como aplicadas las que ya están en la base. Usa la conexión directa (`DIRECT_URL`, `DATABASE_URL_UNPOOLED` o la de `DATABASE_URL` sin `-pooler` en Neon). Si una migración falla, el build se frena y queda publicada la versión anterior.

Desde ahora, cada cambio de `schema.prisma` va con su migración (`npx prisma migrate dev --name descripcion`) y ya no hace falta correr SQL a mano en la base publicada.

## Pruebas automáticas
- `npm test`: pruebas rápidas sin base (`tests/unit`): qué pantallas abre cada rol, quién usa el Asistente de IA, cálculos de pendientes de entrega y el filtro de datos personales del asistente. Corren también dentro de `npm run build`, así que si alguna falla Vercel no publica la versión nueva.
- `npm run test:db`: pruebas contra una base de prueba vacía (`tests/db`): fichas de emergencia, entregas y stock, permisos de usuarios, Asistente de IA por rol, casos de Violencia de Género y que las migraciones dejen la base igual a `schema.prisma`. Necesitan `TEST_DATABASE_URL` apuntando a una base local (solo acepta `localhost`), porque cargan datos de prueba y vacían las tablas:
  ```
  TEST_DATABASE_URL="postgresql://usuario:clave@localhost:5432/muni_test" npm run test:db
  ```
- En GitHub, `.github/workflows/pruebas.yml` corre la revisión de tipos y las dos tandas de pruebas en cada PR y en cada cambio de la rama publicada, con una base Postgres descartable.

## Migraciones en una base que ya existe (manual)
La base publicada se creó con `prisma db push`, sin historial de migraciones. El paso automático de arriba ya resuelve esto; si alguna vez hiciera falta hacerlo a mano, hay que marcar como aplicadas las migraciones que ya están reflejadas en la base (una sola vez):
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

### Entregas de emergencia y refugios (octubre 2026)
`prisma/migrations/20261014100000_storm_deliveries/migration.sql` crea la tabla de entregas de las fichas de tormenta (`StormDelivery`) y borra la tabla `Shelter` (refugios), que ya no se usa. También se puede correr más de una vez. Mientras no se aplique, la app funciona pero no deja registrar entregas.

## Modo sin conexión (Emergencia Climática)
`public/sw.js` guarda en el dispositivo la pantalla `/admin/emergency` y sus archivos (solo en producción). Las fichas cargadas sin internet quedan en el navegador (`src/lib/emergency-offline.ts`) y se envían a `/api/emergency/fichas` cuando vuelve la conexión; cada una lleva un `clientId`, así que reenviarla no la duplica. Al cerrar sesión se borra la pantalla guardada, pero no las fichas pendientes de envío.

## .env
```
DATABASE_URL="postgresql://user:password@localhost:5432/munidb?schema=public"
AUTH_SECRET="tu-secreto-aqui"
```

## Usuario administrador inicial (Seed)
`npx prisma db seed` crea `admin@municipio.gob.ar` solo si no existe. La clave inicial sale de `SEED_ADMIN_PASSWORD` o, si no está, se genera al azar y se muestra una vez en la consola. Si el usuario ya existe, el seed no cambia su clave.
