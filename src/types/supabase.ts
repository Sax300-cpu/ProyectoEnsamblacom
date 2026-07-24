/* WARNING: This schema is for context only and is not meant to be run.
   Table order and constraints may not be valid for execution. */

/*
CREATE TABLE public.categorias (
  id_categoria bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categorias_pkey PRIMARY KEY (id_categoria)
);
CREATE TABLE public.marcas (
  id_marca bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT marcas_pkey PRIMARY KEY (id_marca)
);
CREATE TABLE public.modelos (
  id_modelo bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_marca bigint NOT NULL,
  nombre character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT modelos_pkey PRIMARY KEY (id_modelo),
  CONSTRAINT fk_marca FOREIGN KEY (id_marca) REFERENCES public.marcas(id_marca)
);
CREATE TABLE public.distribuidores (
  id_distribuidor bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  contacto character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT distribuidores_pkey PRIMARY KEY (id_distribuidor)
);
CREATE TABLE public.repuestos (
  id_repuesto bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_categoria bigint NOT NULL,
  id_distribuidor bigint,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  costo_distribuidor numeric NOT NULL DEFAULT 0.00,
  precio_tecnico numeric NOT NULL DEFAULT 0.00,
  precio_cliente numeric NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  atributos jsonb NOT NULL DEFAULT '{}'::jsonb,
  id_modelo_principal bigint NOT NULL,
  CONSTRAINT repuestos_pkey PRIMARY KEY (id_repuesto),
  CONSTRAINT fk_categoria FOREIGN KEY (id_categoria) REFERENCES public.categorias(id_categoria),
  CONSTRAINT fk_distribuidor FOREIGN KEY (id_distribuidor) REFERENCES public.distribuidores(id_distribuidor),
  CONSTRAINT repuestos_id_modelo_principal_fkey FOREIGN KEY (id_modelo_principal) REFERENCES public.modelos(id_modelo)
);
CREATE TABLE public.repuestos_compatibilidad (
  id_repuesto bigint NOT NULL,
  id_modelo bigint NOT NULL,
  CONSTRAINT repuestos_compatibilidad_pkey PRIMARY KEY (id_repuesto, id_modelo),
  CONSTRAINT repuestos_compatibilidad_id_repuesto_fkey FOREIGN KEY (id_repuesto) REFERENCES public.repuestos(id_repuesto),
  CONSTRAINT repuestos_compatibilidad_id_modelo_fkey FOREIGN KEY (id_modelo) REFERENCES public.modelos(id_modelo)
);
CREATE TABLE public.ventas (
  id_venta bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha_hora timestamp with time zone NOT NULL DEFAULT now(),
  alias_tecnico text,
  estado_pago text NOT NULL CHECK (estado_pago = ANY (ARRAY['Pagado'::text, 'Fiado'::text, 'A Prueba'::text, 'Garantia'::text])),
  metodo_pago text CHECK (metodo_pago = ANY (ARRAY['Efectivo'::text, 'Transferencia'::text, 'Pendiente'::text])),
  total numeric NOT NULL DEFAULT 0,
  notas text,
  CONSTRAINT ventas_pkey PRIMARY KEY (id_venta)
);
CREATE TABLE public.detalles_venta (
  id_detalle bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_venta bigint NOT NULL,
  id_repuesto bigint NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  CONSTRAINT detalles_venta_pkey PRIMARY KEY (id_detalle),
  CONSTRAINT detalles_venta_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta),
  CONSTRAINT detalles_venta_id_repuesto_fkey FOREIGN KEY (id_repuesto) REFERENCES public.repuestos(id_repuesto)
);
CREATE TABLE public.cuarentena_defectuosos (
  id_cuarentena bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_repuesto bigint NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  origen text NOT NULL CHECK (origen = ANY (ARRAY['Proveedor'::text, 'Devolucion Cliente'::text])),
  estado_revision text NOT NULL CHECK (estado_revision = ANY (ARRAY['Pendiente de Prueba'::text, 'Devuelto a Proveedor'::text, 'Perdida Asumida'::text])),
  fecha_ingreso timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cuarentena_defectuosos_pkey PRIMARY KEY (id_cuarentena),
  CONSTRAINT cuarentena_defectuosos_id_repuesto_fkey FOREIGN KEY (id_repuesto) REFERENCES public.repuestos(id_repuesto)
);
*/
