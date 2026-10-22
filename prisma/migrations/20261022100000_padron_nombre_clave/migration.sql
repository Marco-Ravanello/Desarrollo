-- Nombre comparable de cada persona del padrón (sin tildes ni signos, palabras en orden
-- alfabético), para que "Posibles duplicados" agrupe por un índice en lugar de calcularlo
-- para todo el padrón en cada visita. Es la misma regla que nameKey() en
-- src/lib/padron-duplicates.ts (tests/db/padron-nombre-clave.test.ts las compara).
-- Queda vacío si el nombre tiene una sola palabra o tres letras o menos. Las letras con tilde
-- van también en minúscula por si la base no sabe pasarlas a mayúscula.
-- Se puede correr más de una vez.

ALTER TABLE "padron_unificado" ADD COLUMN IF NOT EXISTS "nombre_clave" TEXT;

CREATE OR REPLACE FUNCTION padron_nombre_clave(nombre TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN length(trim(COALESCE(nombre, ''))) > 3 AND position(' ' in k) > 0 THEN k END
  FROM (
    SELECT array_to_string(ARRAY(
      SELECT w FROM unnest(regexp_split_to_array(
        regexp_replace(translate(upper(COALESCE(nombre, '')), 'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÃÕÇáéíóúüñàèìòùâêîôûäëïöãõç', 'AEIOUUNAEIOUAEIOUAEIOAOCAEIOUUNAEIOUAEIOUAEIOAOC'), '[^A-Z]+', ' ', 'g'), ' ')) AS w
      WHERE w <> '' ORDER BY w COLLATE "C"), ' ') AS k
  ) AS clave
$$;

CREATE OR REPLACE FUNCTION padron_set_nombre_clave() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."nombre_clave" := padron_nombre_clave(NEW."nombre_completo");
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS padron_nombre_clave ON "padron_unificado";
CREATE TRIGGER padron_nombre_clave
  BEFORE INSERT OR UPDATE OF "nombre_completo" ON "padron_unificado"
  FOR EACH ROW EXECUTE FUNCTION padron_set_nombre_clave();

UPDATE "padron_unificado"
SET "nombre_clave" = padron_nombre_clave("nombre_completo")
WHERE "nombre_clave" IS DISTINCT FROM padron_nombre_clave("nombre_completo");

CREATE INDEX IF NOT EXISTS "padron_unificado_nombre_clave_idx" ON "padron_unificado"("nombre_clave");
