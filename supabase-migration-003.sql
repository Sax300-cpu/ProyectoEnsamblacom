-- =============================================================
-- Migration 003: Tablas de ventas y detalles_venta
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================

CREATE TABLE IF NOT EXISTS ventas (
  id_venta      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alias_tecnico TEXT NOT NULL,
  estado_pago   TEXT NOT NULL DEFAULT 'Pagado',
  metodo_pago   TEXT NOT NULL DEFAULT 'Efectivo',
  total         NUMERIC(10,2) NOT NULL,
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detalles_venta (
  id_detalle     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta       BIGINT NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
  id_repuesto    INTEGER NOT NULL REFERENCES repuestos(id_repuesto),
  cantidad       INTEGER NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal       NUMERIC(10,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detalles_venta_venta   ON detalles_venta(id_venta);
CREATE INDEX IF NOT EXISTS idx_detalles_venta_repuesto ON detalles_venta(id_repuesto);
