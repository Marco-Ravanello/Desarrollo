-- Se ingresa con un nombre de usuario; el correo pasa a ser un dato aparte.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Cada usuario que ya existe recibe como nombre lo que está antes de la @ de su correo
-- (en minúsculas y sin caracteres raros). Si dos coinciden, el más nuevo lleva -2, -3...
-- y si igual choca con otro nombre, se le suma un pedacito del id. Todo en un solo paso,
-- para que nunca queden dos iguales.
WITH base AS (
  SELECT
    id,
    "createdAt",
    COALESCE(NULLIF(regexp_replace(lower(split_part(COALESCE(email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'usuario') AS b
  FROM "User"
  WHERE "username" IS NULL
),
numbered AS (
  SELECT id, "createdAt", CASE WHEN n = 1 THEN b ELSE b || '-' || n END AS cand
  FROM (SELECT id, "createdAt", b, row_number() OVER (PARTITION BY b ORDER BY "createdAt", id) AS n FROM base) x
),
ranked AS (
  SELECT
    id,
    cand,
    row_number() OVER (PARTITION BY cand ORDER BY "createdAt", id) AS k,
    EXISTS (SELECT 1 FROM "User" o WHERE o."username" = numbered.cand) AS taken
  FROM numbered
)
UPDATE "User" u
SET "username" = CASE WHEN r.k = 1 AND NOT r.taken THEN r.cand ELSE r.cand || '-' || substr(r.id, 1, 6) END
FROM ranked r
WHERE u.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
