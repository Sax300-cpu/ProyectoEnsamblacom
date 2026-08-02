-- Migration 006: Add 'Reemplazado' to estado_revision CHECK on cuarentena_defectuosos.

-- Drop the existing CHECK constraint on estado_revision regardless of its auto-generated name
DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.cuarentena_defectuosos'::regclass
      AND c.contype = 'c'
      AND a.attname = 'estado_revision'
  LOOP
    EXECUTE format('ALTER TABLE public.cuarentena_defectuosos DROP CONSTRAINT %I', conname);
  END LOOP;
END $$;

ALTER TABLE public.cuarentena_defectuosos
  ADD CONSTRAINT cuarentena_defectuosos_estado_revision_check
    CHECK (estado_revision = ANY (ARRAY['En tienda'::text, 'Pendiente de Prueba'::text, 'Devuelto a Proveedor'::text, 'Perdida Asumida'::text, 'Reemplazado'::text]));
