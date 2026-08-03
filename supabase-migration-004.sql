-- Migration 004: Relax CHECK constraints on cuarentena_defectuosos
-- to accept 'Interno' (origen) and 'En tienda' (estado_revision).

-- Drop existing CHECK constraints on origen/estado_revision regardless of their auto-generated names
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
      AND a.attname IN ('origen', 'estado_revision')
  LOOP
    EXECUTE format('ALTER TABLE public.cuarentena_defectuosos DROP CONSTRAINT %I', conname);
  END LOOP;
END $$;

ALTER TABLE public.cuarentena_defectuosos
  ADD CONSTRAINT cuarentena_defectuosos_origen_check
    CHECK (origen = ANY (ARRAY['Proveedor'::text, 'Devolucion Cliente'::text, 'Interno'::text]));

ALTER TABLE public.cuarentena_defectuosos
  ADD CONSTRAINT cuarentena_defectuosos_estado_revision_check
    CHECK (estado_revision = ANY (ARRAY['Pendiente de Prueba'::text, 'Devuelto a Proveedor'::text, 'Perdida Asumida'::text, 'En tienda'::text]));
