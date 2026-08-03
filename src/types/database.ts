export type EstadoPago = 'Pagado' | 'Fiado' | 'A Prueba' | 'Garantia'
export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Pendiente'

export interface Categoria {
  id_categoria: number
  nombre: string
  descripcion: string | null
  created_at: string
}

export interface Marca {
  id_marca: number
  nombre: string
  created_at: string
}

export interface Modelo {
  id_modelo: number
  id_marca: number
  nombre: string
  created_at: string
  marcas?: Marca
}

export interface Distribuidor {
  id_distribuidor: number
  nombre: string
  contacto: string | null
  created_at: string
}

export interface Repuesto {
  id_repuesto: number
  id_categoria: number
  id_distribuidor: number | null
  id_modelo_principal: number
  stock: number
  costo_distribuidor: number
  precio_tecnico: number
  precio_cliente: number
  atributos: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface RepuestoCompatibilidad {
  id_repuesto: number
  id_modelo: number
}

export interface RepuestoConRelaciones extends Repuesto {
  repuestos_compatibilidad: {
    id_modelo: number
    modelos: Pick<Modelo, 'id_modelo' | 'nombre'> & {
      marcas: Pick<Marca, 'id_marca' | 'nombre'>
    }
  }[]
  categorias: Pick<Categoria, 'id_categoria' | 'nombre'>
  distribuidores: Pick<Distribuidor, 'id_distribuidor' | 'nombre'>
  modelos?: Pick<Modelo, 'id_modelo' | 'nombre'> & {
    marcas: Pick<Marca, 'id_marca' | 'nombre'>
  }
}

export interface Venta {
  id_venta: number
  alias_tecnico: string
  estado_pago: EstadoPago
  metodo_pago: MetodoPago | null
  total: number
  notas: string | null
  fecha_hora: string
  numero_comprobante?: string | null
  fecha_cobro?: string | null
}

export interface DetalleVenta {
  id_detalle: number
  id_venta: number
  id_repuesto: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  estado_item?: 'Pendiente' | 'Liquidado' | 'Devuelto'
  fecha_pago_item?: string | null
  metodo_pago_item?: string | null
  referencia_item?: string | null
}

export interface DetalleVentaConRepuesto extends DetalleVenta {
  repuestos: RepuestoConRelaciones
}

export interface VentaConDetalles extends Venta {
  detalles_venta: DetalleVentaConRepuesto[]
}

export interface CuarentenaDefectuoso {
  id_cuarentena: number
  id_repuesto: number
  cantidad: number
  origen: 'Proveedor' | 'Devolucion Cliente'
  estado_revision: 'Pendiente de Prueba' | 'Devuelto a Proveedor' | 'Perdida Asumida'
  fecha_ingreso: string
}
