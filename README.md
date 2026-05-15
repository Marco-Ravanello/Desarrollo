# Plataforma Municipal de Desarrollo Humano y Hábitat

MVP de plataforma web interna para centralizar información social y administrativa.

## Instalación Local
1. `npm install`
2. `docker-compose up -d`
3. Configurar `.env`
4. `npx prisma migrate dev`
5. `npm run dev`

## .env
```
DATABASE_URL="postgresql://user:password@localhost:5432/munidb?schema=public"
AUTH_SECRET="tu-secreto-aqui"
```

## Credenciales de prueba (Seed)
- **Email**: admin@municipio.gob.ar
- **Password**: admin123
