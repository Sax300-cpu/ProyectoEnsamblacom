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
  id_modelo: number
  id_categoria: number
  id_distribuidor: number
  stock: number
  costo_distribuidor: number
  precio_tecnico: number
  precio_cliente: number
  created_at: string
  updated_at: string
}

export interface RepuestoConRelaciones extends Repuesto {
  modelos: Pick<Modelo, 'id_modelo' | 'nombre'> & {
    marcas: Pick<Marca, 'id_marca' | 'nombre'>
  }
  categorias: Pick<Categoria, 'id_categoria' | 'nombre'>
  distribuidores: Pick<Distribuidor, 'id_distribuidor' | 'nombre'>
}
