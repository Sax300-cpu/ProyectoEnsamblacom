-- Migration 005: Add id_venta and id_cliente links to cuarentena_defectuosos
-- for the client warranty/return flow (Fase 2).

ALTER TABLE public.cuarentena_defectuosos
  ADD COLUMN IF NOT EXISTS id_venta bigint,
  ADD COLUMN IF NOT EXISTS id_cliente bigint;

ALTER TABLE public.cuarentena_defectuosos
  ADD CONSTRAINT cuarentena_defectuosos_id_venta_fkey
    FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta);

ALTER TABLE public.cuarentena_defectuosos
  ADD CONSTRAINT cuarentena_defectuosos_id_cliente_fkey
    FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente);
