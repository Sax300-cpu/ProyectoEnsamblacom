-- =============================================================
-- Migration: Refactorización de inventario
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================

-- 1. Agregar columna atributos JSONB
ALTER TABLE repuestos
  ADD COLUMN atributos JSONB NOT NULL DEFAULT '{}';

-- 2. Eliminar columna id_modelo (quitar FK si existe primero)
ALTER TABLE repuestos DROP COLUMN IF EXISTS id_modelo;

-- 3. Crear tabla puente muchos-a-muchos
CREATE TABLE IF NOT EXISTS repuestos_compatibilidad (
  id_repuesto INTEGER NOT NULL REFERENCES repuestos(id_repuesto) ON DELETE CASCADE,
  id_modelo   INTEGER NOT NULL REFERENCES modelos(id_modelo) ON DELETE CASCADE,
  PRIMARY KEY (id_repuesto, id_modelo)
);

-- 4. Índice para búsquedas por repuesto
CREATE INDEX IF NOT EXISTS idx_repuestos_compatibilidad_repuesto
  ON repuestos_compatibilidad(id_repuesto);

-- 5. Índice para búsquedas por modelo
CREATE INDEX IF NOT EXISTS idx_repuestos_compatibilidad_modelo
  ON repuestos_compatibilidad(id_modelo);

-- 6. Unique constraint (categoría + distribuidor + atributos)
ALTER TABLE repuestos ADD CONSTRAINT repuestos_unique_cat_dist_atributos
  UNIQUE (id_categoria, id_distribuidor, atributos);
