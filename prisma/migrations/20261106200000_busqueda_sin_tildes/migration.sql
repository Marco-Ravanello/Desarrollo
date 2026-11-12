-- Búsqueda sin tildes ni orden de las palabras (idea 103).
-- texto_sin_tildes() deja un texto en mayúsculas, sin tildes y con letras y números separados
-- por un espacio. Es la misma regla que normalizarBusqueda() en src/lib/search-text.ts
-- (tests/db/busqueda-sin-tildes.test.ts las compara). Las letras con tilde van también en
-- minúscula por si la base no sabe pasarlas a mayúscula.
-- padron_unificado.texto_busqueda guarda nombre, barrio, localidad y dirección ya pasados por esa
-- regla (lo calcula un trigger), así buscar en las 82.000 personas no tiene que recalcularlo.
-- Se puede correr más de una vez.

CREATE OR REPLACE FUNCTION texto_sin_tildes(texto TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(
    translate(upper(COALESCE(texto, '')), 'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÃÕÇáéíóúüñàèìòùâêîôûäëïöãõç', 'AEIOUUNAEIOUAEIOUAEIOAOCAEIOUUNAEIOUAEIOUAEIOAOC'),
    '[^A-Z0-9]+', ' ', 'g'))
$$;

ALTER TABLE "padron_unificado" ADD COLUMN IF NOT EXISTS "texto_busqueda" TEXT;

CREATE OR REPLACE FUNCTION padron_set_texto_busqueda() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."texto_busqueda" := texto_sin_tildes(concat_ws(' ', NEW."nombre_completo", NEW."barrio", NEW."localidad", NEW."direccion"));
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS padron_texto_busqueda ON "padron_unificado";
CREATE TRIGGER padron_texto_busqueda
  BEFORE INSERT OR UPDATE OF "nombre_completo", "barrio", "localidad", "direccion" ON "padron_unificado"
  FOR EACH ROW EXECUTE FUNCTION padron_set_texto_busqueda();

UPDATE "padron_unificado"
SET "texto_busqueda" = texto_sin_tildes(concat_ws(' ', "nombre_completo", "barrio", "localidad", "direccion"))
WHERE "texto_busqueda" IS DISTINCT FROM texto_sin_tildes(concat_ws(' ', "nombre_completo", "barrio", "localidad", "direccion"));
