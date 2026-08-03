-- Migración 007: Auditoría de pagos por ítem en detalles_venta
-- Agrega campos de cobro diferido para que los reportes lean pagos a nivel de ítem.

ALTER TABLE public.detalles_venta
  ADD COLUMN IF NOT EXISTS fecha_pago_item timestamp with time zone,
  ADD COLUMN IF NOT EXISTS metodo_pago_item text,
  ADD COLUMN IF NOT EXISTS referencia_item text;
