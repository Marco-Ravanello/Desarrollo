-- ¿La dirección del padrón tiene calle y altura? Sirve para mostrar aparte, como aproximados,
-- los puntos de las personas que solo tienen el barrio cargado (Mapa Social y Ubicar en el mapa).
-- La regla es la misma que cleanAddressForSearch() en src/lib/geocoding.ts: si se cambia una,
-- hay que cambiar la otra (tests/db/ubicacion-aproximada.test.ts las compara).
-- Se puede correr más de una vez.

ALTER TABLE "padron_unificado" ADD COLUMN IF NOT EXISTS "direccion_con_altura" BOOLEAN;

CREATE OR REPLACE FUNCTION padron_direccion_con_altura(dir TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT t ~* '[a-záéíóúñ]{2,}'
     AND t ~ '\m[0-9]{1,5}\M'
     AND t !~* '^(barrio|b|bo\.?)\s'
     AND t !~* '^puerta\s*(8|ocho)$'
  FROM (
    SELECT regexp_replace(trim(regexp_replace(
      trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(COALESCE(dir, ''),
        '\(.*?\)', ' ', 'g'),
        '\m(n[°º]|no\.|nro\.?|n[uú]mero)(?![a-záéíóúñ])\s*', ' ', 'gi'),
        '[°º]', ' ', 'g'),
        '\s+', ' ', 'g')),
      '[,\s]+(piso|p\.|depto|dpto|dto|departamento|torre|tira|casa|lote|e/|entre)(?![a-záéíóúñ]).*$', '', 'i')),
      '[,;.\s]+$', '') AS t
  ) AS limpia
$$;

CREATE OR REPLACE FUNCTION padron_set_direccion_con_altura() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."direccion_con_altura" := padron_direccion_con_altura(NEW."direccion");
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS padron_direccion_con_altura ON "padron_unificado";
CREATE TRIGGER padron_direccion_con_altura
  BEFORE INSERT OR UPDATE OF "direccion" ON "padron_unificado"
  FOR EACH ROW EXECUTE FUNCTION padron_set_direccion_con_altura();

UPDATE "padron_unificado"
SET "direccion_con_altura" = padron_direccion_con_altura("direccion")
WHERE "direccion_con_altura" IS DISTINCT FROM padron_direccion_con_altura("direccion");
