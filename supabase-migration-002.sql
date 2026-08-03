-- =============================================================
-- Migration 002: Agregar id_modelo_principal + corregir UNIQUE
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================

-- 1. Agregar columna id_modelo_principal (requiere NOT NULL, asignar valor primero si hay datos)
ALTER TABLE repuestos
  ADD COLUMN id_modelo_principal BIGINT
  REFERENCES modelos(id_modelo);

-- Si ya hay datos, asignar un modelo por defecto (ajusta según tu caso)
-- UPDATE repuestos SET id_modelo_principal = (SELECT id_modelo FROM modelos LIMIT 1) WHERE id_modelo_principal IS NULL;

-- Luego hacer NOT NULL
ALTER TABLE repuestos
  ALTER COLUMN id_modelo_principal SET NOT NULL;

-- 2. Eliminar el constraint anterior
ALTER TABLE repuestos
  DROP CONSTRAINT IF EXISTS repuestos_unique_cat_dist_atributos;

-- 3. Nuevo unique incluyendo id_modelo_principal
ALTER TABLE repuestos
  ADD CONSTRAINT repuestos_unique_cat_dist_mod_atributos
  UNIQUE (id_categoria, id_distribuidor, id_modelo_principal, atributos);
